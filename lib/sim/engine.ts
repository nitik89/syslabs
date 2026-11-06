import { CATALOG } from "./catalog";
import {
  TRAFFIC_CLASSES,
  type Bottleneck,
  type GraphIssue,
  type Health,
  type NodeConfig,
  type NodeKind,
  type NodeResult,
  type NodeStatus,
  type SimGraph,
  type SimNode,
  type SimResult,
  type SpofResult,
  type TrafficClass,
  type TrafficProfile,
} from "./types";

/* ------------------------------------------------------------------ */
/* Tunable model constants (deterministic, documented)                 */
/* ------------------------------------------------------------------ */

/** Utilization at or above which a node is "running hot". */
export const WARN_UTILIZATION = 0.8;
/** A node is a SPOF if its failure loses at least this share of offered traffic. */
export const SPOF_THRESHOLD = 0.1;

const STORE_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb", "search", "objectStorage"]);
const DB_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb"]);
const COMPUTE_KINDS: ReadonlySet<NodeKind> = new Set(["loadBalancer", "apiGateway", "appServer"]);

/**
 * Cache hit ratio from hot-key fraction and cache size.
 * Hot keys are almost always cached; cold keys rarely are. A bigger cache holds more of the working set,
 * with diminishing returns (it saturates around 30 GB).
 */
export function cacheHitRatio(hotKeyFraction: number, cacheSizeGb: number): number {
  const hot = clamp01(hotKeyFraction);
  const size = Math.max(0, cacheSizeGb);
  const keyAffinity = hot * 0.95 + (1 - hot) * 0.3;
  const sizeFactor = 1 - Math.exp(-size / 6);
  return Math.min(0.98, keyAffinity * sizeFactor);
}

/**
 * Latency multiplier from utilization: flat until 50%, then rises quadratically to 5× at 100%.
 * Overloaded nodes stay at 5× (they are serving at capacity and dropping the excess).
 */
export function queueingFactor(utilization: number): number {
  if (!Number.isFinite(utilization)) return 5;
  const u = Math.min(1, Math.max(0, utilization));
  if (u <= 0.5) return 1;
  const x = (u - 0.5) / 0.5;
  return 1 + 4 * x * x;
}

/* ------------------------------------------------------------------ */
/* Internal flow bookkeeping                                           */
/* ------------------------------------------------------------------ */

/** A stream of requests: rps, plus Σ(rps × accumulated latency) so averages stay exact when merged. */
interface Flow {
  rps: number;
  latSum: number;
}
type Mode = "sync" | "async";
type Buckets = Record<Mode, Record<TrafficClass, Flow>>;

function emptyBuckets(): Buckets {
  const mk = () => ({ read: { rps: 0, latSum: 0 }, write: { rps: 0, latSum: 0 }, static: { rps: 0, latSum: 0 } });
  return { sync: mk(), async: mk() };
}

interface RunOptions {
  /** Nodes treated as completely down (used for SPOF analysis). */
  failed?: ReadonlySet<string>;
}

interface CoreOutcome {
  offered: number;
  served: number;
  servedLatSum: number;
  errors: number;
  /** Errors caused by failed nodes or unroutable traffic (used for SPOF analysis). */
  structuralErrors: number;
  backlog: number;
  cacheLookups: number;
  cacheHits: number;
  nodes: Record<string, NodeResult>;
  edgeFlows: Record<string, number>;
  noRoute: Array<{ nodeId: string; cls: TrafficClass; mode: Mode; rps: number }>;
  issues: GraphIssue[];
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export function simulate(graph: SimGraph, traffic: TrafficProfile): SimResult {
  const base = runCore(graph, traffic, {});
  const cleanTraffic = sanitizeTraffic(traffic);

  const bottlenecks = findBottlenecks(base, graph);
  const spofs = base.offered > 0 ? findSpofs(graph, cleanTraffic, base) : [];

  let dbLoad = 0;
  for (const n of Object.values(base.nodes)) if (DB_KINDS.has(n.kind)) dbLoad += n.load;

  const monthlyCost = graph.nodes.reduce((sum, n) => {
    const c = sanitizeConfig(n.config);
    return sum + c.costPerReplica * c.replicas;
  }, 0);

  const errorRate = base.offered > 0 ? base.errors / base.offered : 0;

  return {
    simulated: true,
    offeredRps: base.offered,
    servedRps: base.served,
    errorRps: base.errors,
    errorRate,
    avgLatencyMs: base.served > 0 ? base.servedLatSum / base.served : null,
    dbLoadRps: dbLoad,
    cacheHitRatio: base.cacheLookups > 0 ? base.cacheHits / base.cacheLookups : null,
    backlogRps: base.backlog,
    monthlyCost,
    nodes: base.nodes,
    edgeFlows: base.edgeFlows,
    bottlenecks,
    spofs,
    issues: base.issues,
    health: deriveHealth(base, errorRate, bottlenecks),
  };
}

/* ------------------------------------------------------------------ */
/* Core propagation                                                    */
/* ------------------------------------------------------------------ */

function runCore(graph: SimGraph, rawTraffic: TrafficProfile, opts: RunOptions): CoreOutcome {
  const traffic = sanitizeTraffic(rawTraffic);
  const failed = opts.failed ?? new Set<string>();
  const issues: GraphIssue[] = [];

  const nodeById = new Map<string, SimNode>();
  for (const n of graph.nodes) {
    if (nodeById.has(n.id)) {
      issues.push({ nodeId: n.id, message: `Duplicate node id "${n.id}" ignored.` });
      continue;
    }
    nodeById.set(n.id, n);
  }

  // Traffic adjacency (monitoring links carry no user traffic).
  const children = new Map<string, Array<{ target: string; edgeId: string | null }>>();
  const parents = new Map<string, string[]>();
  for (const id of nodeById.keys()) {
    children.set(id, []);
    parents.set(id, []);
  }
  const seenPairs = new Set<string>();
  for (const e of graph.edges) {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (!s || !t) {
      issues.push({ edgeId: e.id, message: "Connection points to a missing component." });
      continue;
    }
    if (s.id === t.id) {
      issues.push({ edgeId: e.id, message: "A component cannot connect to itself." });
      continue;
    }
    if (s.kind === "monitoring" || t.kind === "monitoring") continue;
    if (t.kind === "client") {
      issues.push({ edgeId: e.id, message: "Clients only send traffic; connections into a client are ignored." });
      continue;
    }
    const key = `${s.id}->${t.id}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    children.get(s.id)!.push({ target: t.id, edgeId: e.id });
    parents.get(t.id)!.push(s.id);
  }

  // Cache-aside: a cache with no downstream gets virtual read paths to the databases its parents use.
  for (const n of nodeById.values()) {
    if (n.kind !== "cache" || children.get(n.id)!.length > 0) continue;
    const added = new Set<string>();
    for (const p of parents.get(n.id)!) {
      for (const c of children.get(p)!) {
        const k = nodeById.get(c.target)!.kind;
        if (DB_KINDS.has(k) && !added.has(c.target)) {
          added.add(c.target);
          children.get(n.id)!.push({ target: c.target, edgeId: null });
        }
      }
    }
  }

  // Topological order via DFS from clients; back edges (cycles) are dropped.
  const clients = [...nodeById.values()].filter((n) => n.kind === "client");
  const order: string[] = [];
  const state = new Map<string, 1 | 2>();
  const backEdges = new Set<string>();
  const visit = (id: string) => {
    state.set(id, 1);
    for (const c of children.get(id)!) {
      const st = state.get(c.target);
      if (st === 1) {
        backEdges.add(`${id}->${c.target}`);
        if (c.edgeId) issues.push({ edgeId: c.edgeId, message: "This connection creates a loop and is ignored." });
      } else if (st === undefined) visit(c.target);
    }
    state.set(id, 2);
    order.push(id);
  };
  for (const c of clients) if (!state.has(c.id)) visit(c.id);
  order.reverse();

  if (clients.length === 0 && nodeById.size > 0) {
    issues.push({ message: "Add a Client: without one, no traffic enters the system." });
  }
  for (const n of nodeById.values()) {
    if (n.kind !== "client" && n.kind !== "monitoring" && !state.has(n.id)) {
      issues.push({ nodeId: n.id, message: `${displayName(n)} isn't connected to any traffic.` });
    }
  }

  const forwardKids = (id: string) => children.get(id)!.filter((c) => !backEdges.has(`${id}->${c.target}`));

  // Seed traffic.
  const inbound = new Map<string, Buckets>();
  for (const id of nodeById.keys()) inbound.set(id, emptyBuckets());
  const offered = clients.length > 0 ? traffic.rps : 0;
  if (clients.length > 0) {
    const per = traffic.rps / clients.length;
    const stat = per * traffic.staticFraction;
    const dyn = per - stat;
    for (const c of clients) {
      const b = inbound.get(c.id)!;
      b.sync.static.rps += stat;
      b.sync.read.rps += dyn * traffic.readRatio;
      b.sync.write.rps += dyn * (1 - traffic.readRatio);
    }
  }

  const out: CoreOutcome = {
    offered,
    served: 0,
    servedLatSum: 0,
    errors: 0,
    structuralErrors: 0,
    backlog: 0,
    cacheLookups: 0,
    cacheHits: 0,
    nodes: {},
    edgeFlows: {},
    noRoute: [],
    issues,
  };
  for (const e of graph.edges) out.edgeFlows[e.id] = 0;

  const send = (targets: Array<{ target: string; edgeId: string | null }>, cls: TrafficClass, mode: Mode, f: Flow) => {
    const share = 1 / targets.length;
    for (const t of targets) {
      const tb = inbound.get(t.target)!;
      tb[mode][cls].rps += f.rps * share;
      tb[mode][cls].latSum += f.latSum * share;
      if (t.edgeId) out.edgeFlows[t.edgeId] += f.rps * share;
    }
  };

  const consume = (mode: Mode, f: Flow) => {
    if (mode === "sync") {
      out.served += f.rps;
      out.servedLatSum += f.latSum;
    }
  };

  const drop = (mode: Mode, rps: number, structural: boolean) => {
    if (rps <= 0) return;
    if (mode === "sync") {
      out.errors += rps;
      if (structural) out.structuralErrors += rps;
    } else {
      out.backlog += rps;
    }
  };

  for (const id of order) {
    const node = nodeById.get(id)!;
    const spec = CATALOG[node.kind];
    const cfg = sanitizeConfig(node.config);
    const b = inbound.get(id)!;

    const loadByClass: Record<TrafficClass, number> = { read: 0, write: 0, static: 0 };
    for (const cls of TRAFFIC_CLASSES) loadByClass[cls] = b.sync[cls].rps + b.async[cls].rps;
    const load = loadByClass.read + loadByClass.write + loadByClass.static;

    // Utilization: Σ load_c / capacity_c. SQL writes are limited to the primary.
    let utilization = 0;
    let totalCapacity: number | null = null;
    if (!spec.unlimited) {
      totalCapacity = cfg.capacity * cfg.replicas;
      for (const cls of TRAFFIC_CLASSES) {
        const cap = node.kind === "sqlDb" && cls === "write" ? cfg.capacity : totalCapacity;
        if (loadByClass[cls] > 0) utilization += cap > 0 ? loadByClass[cls] / cap : Infinity;
      }
    }
    const isFailed = failed.has(id);
    const serveFrac = isFailed ? 0 : utilization <= 1 ? 1 : 1 / utilization;
    const latency = cfg.latencyMs * queueingFactor(utilization);

    let dropped = 0;
    let hitRatio: number | undefined;
    let nodeBacklog = 0;
    const allKids = forwardKids(id);
    const kids = allKids.filter((c) => !failed.has(c.target));

    for (const mode of ["sync", "async"] as const) {
      for (const cls of TRAFFIC_CLASSES) {
        const inFlow = b[mode][cls];
        if (inFlow.rps <= 0) continue;

        const servedRps = inFlow.rps * serveFrac;
        const lost = inFlow.rps - servedRps;
        dropped += lost;
        drop(mode, lost, isFailed);
        if (servedRps <= 0) continue;

        const f: Flow = { rps: servedRps, latSum: inFlow.latSum * serveFrac + servedRps * latency };

        // Cache: hits are answered here, misses continue downstream.
        if (node.kind === "cache" && cls === "read") {
          const hr = cacheHitRatio(traffic.hotKeyFraction, cfg.cacheSizeGb ?? 0);
          hitRatio = hr;
          if (mode === "sync") {
            out.cacheLookups += f.rps;
            out.cacheHits += f.rps * hr;
          }
          consume(mode, scale(f, hr));
          const miss = scale(f, 1 - hr);
          if (miss.rps > 0) {
            const targets = kids.filter((k) => accepts(nodeById.get(k.target)!, "read", children));
            if (targets.length > 0) send(targets, "read", mode, miss);
            else {
              drop(mode, miss.rps, true);
              dropped += miss.rps;
              out.noRoute.push({ nodeId: id, cls, mode, rps: miss.rps });
            }
          }
          continue;
        }

        // Queue: acknowledge synchronously, deliver asynchronously.
        if (node.kind === "queue") {
          consume(mode, f);
          const targets = kids.filter((k) => accepts(nodeById.get(k.target)!, cls, children));
          const asyncFlow: Flow = { rps: f.rps, latSum: 0 };
          if (targets.length > 0) send(targets, cls, "async", asyncFlow);
          else {
            out.backlog += f.rps;
            nodeBacklog += f.rps;
          }
          continue;
        }

        const route = routeFor(node, cls, allKids, nodeById, children, failed);
        if (route === "consume") consume(mode, f);
        else if (route === "none") {
          drop(mode, f.rps, true);
          dropped += f.rps;
          out.noRoute.push({ nodeId: id, cls, mode, rps: f.rps });
        } else send(route, cls, mode, f);
      }
    }

    out.nodes[id] = {
      id,
      kind: node.kind,
      load,
      loadByClass,
      capacity: totalCapacity,
      utilization: isFailed ? 0 : utilization,
      latencyMs: load > 0 ? latency : cfg.latencyMs,
      droppedRps: dropped,
      status: nodeStatus(load, utilization, dropped, isFailed),
      ...(hitRatio !== undefined ? { hitRatio } : {}),
      ...(node.kind === "queue" ? { backlogRps: nodeBacklog } : {}),
    };
  }

  // Nodes never reached still get a result row.
  for (const n of nodeById.values()) {
    if (out.nodes[n.id]) continue;
    const cfg = sanitizeConfig(n.config);
    out.nodes[n.id] = {
      id: n.id,
      kind: n.kind,
      load: 0,
      loadByClass: { read: 0, write: 0, static: 0 },
      capacity: CATALOG[n.kind].unlimited ? null : cfg.capacity * cfg.replicas,
      utilization: 0,
      latencyMs: cfg.latencyMs,
      droppedRps: 0,
      status: "idle",
      ...(n.kind === "cache" ? { hitRatio: cacheHitRatio(traffic.hotKeyFraction, cfg.cacheSizeGb ?? 0) } : {}),
    };
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

type Kid = { target: string; edgeId: string | null };

function accepts(n: SimNode, cls: TrafficClass, children: Map<string, Kid[]>): boolean {
  const hasKids = (children.get(n.id)?.length ?? 0) > 0;
  switch (n.kind) {
    case "client":
    case "monitoring":
      return false;
    case "loadBalancer":
    case "apiGateway":
    case "appServer":
    case "objectStorage":
      return true;
    case "cdn":
      return cls === "static" || hasKids;
    case "cache":
      return cls === "read" || (cls === "write" && hasKids);
    case "sqlDb":
    case "nosqlDb":
    case "search":
      return cls !== "static";
    case "queue":
      return cls === "write";
  }
}

/**
 * Decide where a node sends one traffic class.
 * Candidates come in priority groups (e.g. cache before database). The first group with a healthy member wins,
 * which models fallback (cache down → go straight to the DB). If groups exist but every member is down, the
 * traffic fails ("none"). A node only serves traffic itself ("consume") when it has no downstream at all.
 */
function routeFor(
  node: SimNode,
  cls: TrafficClass,
  kids: Kid[],
  byId: Map<string, SimNode>,
  children: Map<string, Kid[]>,
  failed: ReadonlySet<string>,
): Kid[] | "consume" | "none" {
  const kindOf = (k: Kid) => byId.get(k.target)!.kind;
  const accepting = kids.filter((k) => accepts(byId.get(k.target)!, cls, children));
  const ofKind = (pred: (k: NodeKind) => boolean) => accepting.filter((k) => pred(kindOf(k)));

  let groups: Kid[][];
  let whenNoDownstream: "consume" | "none";

  switch (node.kind) {
    case "client":
    case "loadBalancer":
    case "apiGateway":
      whenNoDownstream = "none";
      if (cls === "static") {
        const cdns = ofKind((k) => k === "cdn");
        groups = [cdns, accepting.filter((k) => !cdns.includes(k))];
      } else {
        // Dynamic traffic skips leaf CDNs (they only serve static assets).
        groups = [accepting.filter((k) => kindOf(k) !== "cdn" || (children.get(k.target)?.length ?? 0) > 0)];
      }
      break;
    case "cdn":
      if (cls === "static") return "consume";
      whenNoDownstream = "none";
      groups = [accepting];
      break;
    case "appServer":
      whenNoDownstream = "consume";
      if (cls === "static") groups = [ofKind((k) => k === "objectStorage" || k === "cdn")];
      else if (cls === "read")
        groups = [ofKind((k) => k === "cache"), ofKind((k) => STORE_KINDS.has(k)), ofKind((k) => COMPUTE_KINDS.has(k))];
      else
        groups = [
          ofKind((k) => k === "queue"),
          ofKind((k) => DB_KINDS.has(k)),
          ofKind((k) => STORE_KINDS.has(k) && !DB_KINDS.has(k)),
          ofKind((k) => k === "cache"),
          ofKind((k) => COMPUTE_KINDS.has(k)),
        ];
      break;
    case "cache":
      // Writes: write-through to the backing store if there is one.
      whenNoDownstream = "consume";
      groups = [accepting];
      break;
    default:
      // Stores, object storage, search, monitoring: terminal.
      return "consume";
  }

  const nonEmpty = groups.filter((g) => g.length > 0);
  if (nonEmpty.length === 0) return whenNoDownstream;
  for (const g of nonEmpty) {
    const live = g.filter((k) => !failed.has(k.target));
    if (live.length > 0) return live;
  }
  return "none";
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

function findBottlenecks(core: CoreOutcome, graph: SimGraph): Bottleneck[] {
  const list: Bottleneck[] = [];
  const nameOf = (id: string) => {
    const n = graph.nodes.find((x) => x.id === id);
    return n ? displayName(n) : id;
  };
  for (const n of graph.nodes) {
    const r = core.nodes[n.id];
    if (!r || r.capacity === null || r.load <= 0) continue;
    if (r.utilization > 1) {
      list.push({
        nodeId: n.id,
        severity: "crit",
        reason: `${nameOf(n.id)} is overloaded: ${fmt(r.load)} rps offered vs ${fmt(effectiveCapacity(r))} capacity, dropping ${fmt(r.droppedRps)} rps.`,
      });
    } else if (r.utilization >= WARN_UTILIZATION) {
      list.push({
        nodeId: n.id,
        severity: "warn",
        reason: `${nameOf(n.id)} is running hot at ${Math.round(r.utilization * 100)}% utilization, with little headroom for spikes.`,
      });
    }
    if (n.kind === "queue" && (r.backlogRps ?? 0) > 0) {
      list.push({
        nodeId: n.id,
        severity: "crit",
        reason: `${nameOf(n.id)} has no consumer. Writes pile up at ${fmt(r.backlogRps!)} rps and are never processed.`,
      });
    }
  }

  // Async overload downstream of a queue shows up as backlog, not errors.
  const merged = new Map<string, number>();
  for (const nr of core.noRoute) merged.set(`${nr.nodeId}|${nr.cls}`, (merged.get(`${nr.nodeId}|${nr.cls}`) ?? 0) + nr.rps);
  for (const [key, rps] of merged) {
    const [nodeId, cls] = key.split("|");
    list.push({
      nodeId,
      severity: "crit",
      reason: `${nameOf(nodeId)} has nowhere to send ${cls} traffic (${fmt(rps)} rps fail).`,
    });
  }

  // Order: critical first, then by node order in the graph (stable and deterministic).
  const idx = new Map(graph.nodes.map((n, i) => [n.id, i]));
  return list.sort((a, b) => (a.severity === b.severity ? (idx.get(a.nodeId)! - idx.get(b.nodeId)!) : a.severity === "crit" ? -1 : 1));
}

/** Capacity for the node's actual read/write mix (differs from capacity × replicas for SQL write-heavy loads). */
function effectiveCapacity(r: NodeResult): number {
  return r.utilization > 0 && Number.isFinite(r.utilization) ? r.load / r.utilization : 0;
}

function findSpofs(graph: SimGraph, traffic: TrafficProfile, base: CoreOutcome): SpofResult[] {
  const result: SpofResult[] = [];
  for (const n of graph.nodes) {
    const spec = CATALOG[n.kind];
    if (spec.inherentlyRedundant) continue;
    if (sanitizeConfig(n.config).replicas > 1) continue;
    const r = base.nodes[n.id];
    if (!r || r.load <= 0) continue;
    const failedRun = runCore(graph, traffic, { failed: new Set([n.id]) });
    const lost = (failedRun.structuralErrors - base.structuralErrors) / base.offered;
    if (lost >= SPOF_THRESHOLD) {
      result.push({
        nodeId: n.id,
        trafficLost: lost,
        reason: `If ${displayName(n)} fails, ${Math.round(lost * 100)}% of traffic has no path. Add replicas or a redundant peer.`,
      });
    }
  }
  return result;
}

function deriveHealth(core: CoreOutcome, errorRate: number, bottlenecks: Bottleneck[]): Health {
  if (core.offered <= 0) return "idle";
  if (errorRate > 0.05 || core.served <= 0) return "critical";
  if (errorRate > 0.005 || core.backlog > 0 || bottlenecks.length > 0) return "degraded";
  return "healthy";
}

function nodeStatus(load: number, utilization: number, dropped: number, failed: boolean): NodeStatus {
  if (failed) return "crit";
  if (load <= 0) return "idle";
  if (utilization > 1 || dropped > 1e-9) return "crit";
  if (utilization >= WARN_UTILIZATION) return "warn";
  return "ok";
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function scale(f: Flow, k: number): Flow {
  return { rps: f.rps * k, latSum: f.latSum * k };
}

function clamp01(x: number): number {
  return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
}

function nonNeg(x: number | undefined, fallback = 0): number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : fallback;
}

export function sanitizeConfig(c: NodeConfig): NodeConfig {
  return {
    capacity: nonNeg(c.capacity),
    latencyMs: nonNeg(c.latencyMs),
    replicas: Math.max(1, Math.floor(nonNeg(c.replicas, 1))),
    costPerReplica: nonNeg(c.costPerReplica),
    ...(c.cacheSizeGb !== undefined ? { cacheSizeGb: nonNeg(c.cacheSizeGb) } : {}),
  };
}

export function sanitizeTraffic(t: TrafficProfile): TrafficProfile {
  return {
    rps: nonNeg(t.rps),
    readRatio: clamp01(t.readRatio),
    hotKeyFraction: clamp01(t.hotKeyFraction),
    staticFraction: clamp01(t.staticFraction ?? 0),
  };
}

function displayName(n: SimNode): string {
  return n.label?.trim() || CATALOG[n.kind].label;
}

function fmt(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}
