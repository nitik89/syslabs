/**
 * A 60-second "load test" built on the steady-state engine: traffic ramps up, then holds near peak with
 * small dips. Each second is one simulate() call, so every number stays deterministic (same design, same
 * timeline). Latency percentiles are derived from the average latency and how hot the busiest component runs:
 * queueing stretches the tail long before it moves the median, and dropped requests count as timeouts.
 */
import { CATALOG } from "./catalog";
import { simulate } from "./engine";
import type { SimGraph, SimResult, TrafficProfile } from "./types";

export interface Percentiles {
  p50: number;
  p95: number;
  p99: number;
}

export interface Tick extends Percentiles {
  t: number;
  offeredRps: number;
  servedRps: number;
  errorRps: number;
  /** Utilization (0..) per node id, for components with a capacity. */
  utilization: Record<string, number>;
  result: SimResult;
}

export type LogLevel = "info" | "warn" | "error";
export interface LogEvent {
  t: number;
  level: LogLevel;
  message: string;
  nodeId?: string;
}

export interface Timeline {
  seconds: number;
  ticks: Tick[];
  events: LogEvent[];
  /** Components that ran hottest at peak, hottest first (up to 4), for charting. */
  busiest: Array<{ id: string; label: string }>;
}

/** A request that is dropped surfaces to the user as a timeout of about this long. */
export const TIMEOUT_MS = 5000;
const RAMP_SECONDS = 8;

/** Tail latency from the mean and the hottest component's utilization. Pure, so it is easy to test. */
export function latencyPercentiles(avgMs: number | null, maxUtilization: number, errorRate: number): Percentiles {
  if (avgMs === null) return errorRate > 0 ? { p50: TIMEOUT_MS, p95: TIMEOUT_MS, p99: TIMEOUT_MS } : { p50: 0, p95: 0, p99: 0 };
  const u = Math.min(Math.max(maxUtilization, 0), 1.2);
  let p50 = avgMs * 0.82;
  let p95 = avgMs * (1.7 + 2.5 * u ** 6);
  let p99 = avgMs * (2.4 + 6 * u ** 8);
  // Dropped requests are the slowest of all: they wait for a timeout. Once they make up more than 1% / 5% / 50%
  // of traffic they own the p99 / p95 / p50.
  if (errorRate > 0.01) p99 = Math.max(p99, TIMEOUT_MS);
  if (errorRate > 0.05) p95 = Math.max(p95, TIMEOUT_MS);
  if (errorRate > 0.5) p50 = Math.max(p50, TIMEOUT_MS);
  return { p50, p95, p99 };
}

/** Percentiles for one steady-state result (equals the last tick of its timeline). */
export function percentilesOf(r: SimResult): Percentiles {
  const errorRate = r.offeredRps > 0 ? r.errorRps / r.offeredRps : 0;
  const p = latencyPercentiles(r.avgLatencyMs, maxUtil(r), errorRate);
  const cap = (x: number) => Math.min(x, TIMEOUT_MS);
  return { p50: cap(p.p50), p95: cap(p.p95), p99: cap(p.p99) };
}

/** Deterministic noise in [0, 1) from an integer. */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Load factor at second t: ramp to peak, then hold with small dips. Never above 1, and exactly 1 at the end. */
export function loadFactor(t: number, seconds: number): number {
  if (t >= seconds - 1) return 1;
  if (t < RAMP_SECONDS) return 0.3 + (0.7 * t) / RAMP_SECONDS;
  return 1 - 0.05 * noise(t);
}

function maxUtil(r: SimResult): number {
  let m = 0;
  for (const n of Object.values(r.nodes)) if (n.capacity !== null && n.load > 0) m = Math.max(m, n.utilization);
  return m;
}

export function simulateTimeline(graph: SimGraph, traffic: TrafficProfile, seconds = 60): Timeline {
  const label = new Map(graph.nodes.map((n) => [n.id, n.label?.trim() || CATALOG[n.kind]?.label || n.id]));
  const ticks: Tick[] = [];
  for (let t = 0; t < seconds; t++) {
    const result = simulate(graph, { ...traffic, rps: traffic.rps * loadFactor(t, seconds) });
    const errorRate = result.offeredRps > 0 ? result.errorRps / result.offeredRps : 0;
    const base = latencyPercentiles(result.avgLatencyMs, maxUtil(result), errorRate);
    // A little jitter so the lines read like a real dashboard; the last tick is exact.
    const j = t === seconds - 1 ? 1 : 0.96 + 0.08 * noise(t + 1000);
    const cap = (x: number) => Math.min(x >= TIMEOUT_MS ? TIMEOUT_MS : x * j, TIMEOUT_MS);
    const utilization: Record<string, number> = {};
    for (const n of Object.values(result.nodes)) if (n.capacity !== null) utilization[n.id] = n.utilization;
    ticks.push({
      t,
      offeredRps: result.offeredRps,
      servedRps: result.servedRps,
      errorRps: result.errorRps,
      p50: cap(base.p50),
      p95: cap(base.p95),
      p99: cap(base.p99),
      utilization,
      result,
    });
  }

  // Log state changes per component: crossing 80% (warn), crossing 100% (error), and recovering.
  const events: LogEvent[] = [];
  const peak = traffic.rps;
  events.push({ t: 0, level: "info", message: `Load test started: ramping to ${Math.round(peak).toLocaleString("en-US")} req/s over ${RAMP_SECONDS}s` });
  const level = new Map<string, 0 | 1 | 2>();
  for (const tick of ticks) {
    for (const [id, u] of Object.entries(tick.utilization)) {
      const now: 0 | 1 | 2 = u > 1 ? 2 : u >= 0.8 ? 1 : 0;
      const before = level.get(id) ?? 0;
      if (now === before) continue;
      level.set(id, now);
      const name = label.get(id) ?? id;
      const pct = `${Math.round(u * 100)}%`;
      const dropped = tick.result.nodes[id]?.droppedRps ?? 0;
      if (now === 2) events.push({ t: tick.t, level: "error", nodeId: id, message: `${name} overloaded at ${pct} of capacity, dropping ${Math.round(dropped).toLocaleString("en-US")} req/s` });
      else if (now === 1) events.push({ t: tick.t, level: "warn", nodeId: id, message: `${name} running hot at ${pct} of capacity` });
      else events.push({ t: tick.t, level: "info", nodeId: id, message: `${name} back under 80% (${pct})` });
    }
  }
  const last = ticks[ticks.length - 1];
  if (last) {
    const r = last.result;
    events.push({ t: last.t, level: "info", message: `Reached peak: ${Math.round(r.offeredRps).toLocaleString("en-US")} req/s offered, ${Math.round(r.servedRps).toLocaleString("en-US")} served` });
    if ((r.backlogRps ?? 0) > 0) events.push({ t: last.t, level: "warn", message: `Queue backlog growing by ${Math.round(r.backlogRps).toLocaleString("en-US")} msg/s` });
    if ((r.unsafeWriteRps ?? 0) > 0) events.push({ t: last.t, level: "error", message: `${Math.round(r.unsafeWriteRps).toLocaleString("en-US")} contended writes/s ran without a lock (double bookings)` });
    for (const s of r.spofs) events.push({ t: last.t, level: "warn", nodeId: s.nodeId, message: `Single point of failure: ${label.get(s.nodeId) ?? s.nodeId}` });
    for (const i of r.issues) events.push({ t: last.t, level: "warn", ...(i.nodeId ? { nodeId: i.nodeId } : {}), message: i.message });
  }

  const busiest = last
    ? Object.entries(last.utilization)
        .filter(([id]) => (last.result.nodes[id]?.load ?? 0) > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([id]) => ({ id, label: label.get(id) ?? id }))
    : [];

  return { seconds, ticks, events, busiest };
}
