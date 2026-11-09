import { CATALOG, NO_TRAFFIC_KINDS, behaviorSatisfies, isNodeAllowed, nodeSpec, type SimGraph, type SimResult } from "@/lib/sim";
import type { Challenge, Objective, ObjectiveMetric, ScoreCategory } from "./types";

export interface CategoryScore {
  category: ScoreCategory;
  score: number;
  weight: number;
  /** Plain-language reasons for lost points. Empty when the category is perfect. */
  notes: string[];
}

export interface ObjectiveResult {
  objective: Objective;
  actual: number | null;
  met: boolean;
}

export interface ChallengeScore {
  total: number;
  passed: boolean;
  categories: CategoryScore[];
  objectives: ObjectiveResult[];
}

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));
const round = (x: number) => Math.round(x);

export function metricValue(metric: ObjectiveMetric, r: SimResult, o?: Objective, graph?: SimGraph): number | null {
  switch (metric) {
    case "componentLoad": {
      if (r.offeredRps <= 0 || !o?.kinds || !graph) return r.offeredRps > 0 ? 0 : null;
      const wanted = new Set(o.kinds);
      return graph.nodes.filter((n) => behaviorSatisfies(nodeSpec(n).behavior, wanted)).reduce((sum, n) => sum + (r.nodes[n.id]?.load ?? 0), 0);
    }
    case "errorRate":
      return r.offeredRps > 0 ? r.errorRate : null;
    case "avgLatencyMs":
      return r.avgLatencyMs;
    case "dbLoadRps":
      return r.dbLoadRps;
    case "spofCount":
      return r.offeredRps > 0 ? r.spofs.length : null;
    case "monthlyCost":
      return r.monthlyCost;
    case "servedRps":
      return r.servedRps;
    case "cacheHitRatio":
      return r.cacheHitRatio;
    case "maxUtilization":
      return Math.max(0, ...Object.values(r.nodes).filter((n) => n.capacity !== null).map((n) => n.utilization));
    case "backlogRps":
      return r.backlogRps;
    case "unsafeWriteRps":
      return r.offeredRps > 0 ? r.unsafeWriteRps : null;
  }
}

export function evaluateObjective(o: Objective, r: SimResult, graph?: SimGraph): ObjectiveResult {
  const actual = metricValue(o.metric, r, o, graph);
  if (actual === null || !Number.isFinite(actual)) return { objective: o, actual, met: false };
  const eps = 1e-9;
  const met = o.op === "<=" ? actual <= o.value + eps : o.op === ">=" ? actual >= o.value - eps : Math.abs(actual - o.value) < eps;
  return { objective: o, actual, met };
}

/**
 * Score a design 0..100. Every input comes from the simulation result and the graph itself,
 * so the same design always gets the same score.
 */
export function scoreChallenge(ch: Challenge, r: SimResult, graph: SimGraph): ChallengeScore {
  const { weights, latencyTargetMs, costBudget } = ch.scoring;
  const noTraffic = r.offeredRps <= 0;

  // Performance: 60% error rate (0% → full, ≥5% → zero), 40% latency (≤ target → full, ≥ 3× target → zero).
  const perfNotes: string[] = [];
  let performance = 0;
  if (noTraffic) perfNotes.push("No traffic reached the system. Add and connect a Client.");
  else {
    const errPts = 60 * (1 - Math.min(1, r.errorRate / 0.05));
    let latPts = 0;
    if (r.avgLatencyMs !== null) {
      const over = Math.max(0, r.avgLatencyMs - latencyTargetMs);
      latPts = 40 * (1 - Math.min(1, over / (2 * latencyTargetMs)));
    }
    performance = errPts + latPts;
    if (r.errorRate > 0) perfNotes.push(`${(r.errorRate * 100).toFixed(1)}% of requests fail.`);
    if (r.avgLatencyMs === null) perfNotes.push("No requests were served.");
    else if (r.avgLatencyMs > latencyTargetMs) perfNotes.push(`Average latency ${r.avgLatencyMs.toFixed(1)} ms is above the ${latencyTargetMs} ms target.`);
  }

  // Reliability.
  const relNotes: string[] = [];
  let reliability = noTraffic ? 0 : 100;
  if (!noTraffic) {
    if (r.spofs.length > 0) {
      reliability -= 35 * r.spofs.length;
      relNotes.push(`${r.spofs.length} single point${r.spofs.length > 1 ? "s" : ""} of failure.`);
    }
    if (r.unsafeWriteRps > 0) {
      reliability -= 40;
      relNotes.push(`${Math.round(r.unsafeWriteRps)} rps of contended writes run without a lock, so items can be double-booked or oversold.`);
    }
    if (r.backlogRps > 0) {
      reliability -= 30;
      relNotes.push("Queued writes are piling up faster than they are processed.");
    }
    const hot = Object.values(r.nodes).filter((n) => n.capacity !== null && n.utilization >= 0.8).length;
    if (hot > 0) {
      reliability -= Math.min(30, 10 * hot);
      relNotes.push(`${hot} component${hot > 1 ? "s run" : " runs"} at 80% utilization or more, with no headroom for spikes.`);
    }
    if (r.errorRate > 0.01) {
      reliability -= 20;
      relNotes.push("Error rate above 1%.");
    }
  }
  reliability = clamp(reliability);

  // Cost: within budget → full, linear to zero at 2× budget.
  const costNotes: string[] = [];
  const overBudget = Math.max(0, r.monthlyCost - costBudget);
  const cost = noTraffic ? 0 : clamp(100 * (1 - overBudget / Math.max(1, costBudget)));
  if (overBudget > 0) costNotes.push(`$${Math.round(r.monthlyCost)} per month is $${Math.round(overBudget)} over the $${costBudget} budget.`);

  // Architecture quality.
  const archNotes: string[] = [];
  let architecture = noTraffic ? 0 : 100;
  if (!noTraffic) {
    const issues = r.issues.length;
    if (issues > 0) {
      architecture -= 15 * issues;
      archNotes.push(`${issues} design issue${issues > 1 ? "s" : ""} (disconnected parts, loops or bad links).`);
    }
    const unrouted = r.bottlenecks.filter((b) => b.reason.includes("nowhere to send")).length;
    if (unrouted > 0) {
      architecture -= 15 * unrouted;
      archNotes.push("Some traffic has no path to a component that can serve it.");
    }
    if (!graph.nodes.some((n) => nodeSpec(n).behavior === "monitoring")) {
      architecture -= 20;
      archNotes.push("No monitoring: you would not know when something breaks.");
    }
    const allowed = new Set(ch.allowedComponents);
    // Delivery tooling is always welcome: it never changes how traffic flows.
    const disallowed = graph.nodes.filter((n) => !isNodeAllowed(n, allowed) && !NO_TRAFFIC_KINDS.has(nodeSpec(n).behavior));
    if (disallowed.length > 0) {
      architecture -= 10 * disallowed.length;
      archNotes.push(`Uses components not allowed here: ${[...new Set(disallowed.map((n) => CATALOG[n.kind].label))].join(", ")}.`);
    }
    const idle = graph.nodes.filter(
      (n) => !NO_TRAFFIC_KINDS.has(nodeSpec(n).behavior) && nodeSpec(n).behavior !== "client" && (r.nodes[n.id]?.load ?? 0) <= 0 && !r.issues.some((i) => i.nodeId === n.id),
    );
    if (idle.length > 0) {
      architecture -= 10 * idle.length;
      archNotes.push(`${idle.length} component${idle.length > 1 ? "s receive" : " receives"} no traffic. Remove or wire ${idle.length > 1 ? "them" : "it"}.`);
    }
  }
  architecture = clamp(architecture);

  // Reliability and cost only count for traffic you actually serve: a cheap design that drops
  // everything is neither reliable nor cost-effective.
  const servedShare = noTraffic ? 0 : Math.min(1, r.servedRps / r.offeredRps);
  if (!noTraffic && servedShare < 0.999) {
    const note = `Scaled by the ${Math.round(servedShare * 100)}% of traffic actually served.`;
    relNotes.push(note);
    costNotes.push(note);
  }

  const raw: Record<ScoreCategory, [number, string[]]> = {
    performance: [clamp(performance), perfNotes],
    reliability: [reliability * servedShare, relNotes],
    cost: [cost * servedShare, costNotes],
    architecture: [architecture, archNotes],
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const categories: CategoryScore[] = (Object.keys(raw) as ScoreCategory[]).map((c) => ({
    category: c,
    score: round(raw[c][0]),
    weight: weights[c] / totalWeight,
    notes: raw[c][1],
  }));
  const total = round(categories.reduce((sum, c) => sum + c.score * c.weight, 0));
  const objectives = ch.objectives.map((o) => evaluateObjective(o, r, graph));
  return { total, passed: !noTraffic && objectives.every((o) => o.met), categories, objectives };
}
