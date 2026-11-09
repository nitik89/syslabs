import { CATALOG, behaviorOf, nodeMonthlyCost, nodeSpec, type ComponentSpec } from "./catalog";
import {
  TRAFFIC_CLASSES,
  type BaseKind,
  type Bottleneck,
  type GraphIssue,
  type Health,
  type IdleExplanation,
  type IndexLevel,
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

/** Components that store data and can be indexed. */
export const INDEXABLE_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb", "timeseriesDb", "search"]);

/**
 * Index trade-off, as multipliers on read capacity, write capacity and base latency.
 * none: reads scan the whole table. heavy: reads hit covering indexes, but every write updates them all.
 */
export const INDEX_EFFECT: Record<IndexLevel, { read: number; write: number; latency: number }> = {
  none: { read: 0.2, write: 1, latency: 4 },
  standard: { read: 1, write: 1, latency: 1 },
  heavy: { read: 1.5, write: 0.6, latency: 0.7 },
};

/** Utilization at or above which a node is "running hot". */
export const WARN_UTILIZATION = 0.8;
/** A node is a SPOF if its failure loses at least this share of offered traffic. */
export const SPOF_THRESHOLD = 0.1;

const STORE_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb", "timeseriesDb", "search", "objectStorage"]);
const DB_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb", "timeseriesDb"]);
const COMPUTE_KINDS: ReadonlySet<NodeKind> = new Set([
  "loadBalancer",
  "apiGateway",
  "rateLimiter",
  "appGateway",
  "websocketGateway",
  "appServer",
  "serverless",
]);
/** Components that take no user traffic: monitoring and the delivery pipeline. Their links are ignored by the traffic model. */
export const NO_TRAFFIC_KINDS: ReadonlySet<NodeKind> = new Set(["monitoring", "codeRepo", "ciPipeline", "containerRegistry", "fineTune"]);
const LOCK_KINDS: ReadonlySet<NodeKind> = new Set(["redisLock", "zookeeper"]);
/** Nodes that only receive side calls (locks, models) rather than routed user traffic. */
const SIDE_KINDS: ReadonlySet<NodeKind> = new Set(["redisLock", "zookeeper", "llm"]);
/** Nodes that make a model call for AI requests when connected to an LLM. */
const AI_CALLERS: ReadonlySet<NodeKind> = new Set(["appServer", "serverless", "worker"]);
/** Nodes that must take a lock before a contended write (the request handler, before it writes or enqueues). */
const LOCK_TAKERS: ReadonlySet<NodeKind> = new Set(["appServer", "serverless"]);
/** Minimum replicas for a node to survive one failure (ZooKeeper needs a majority quorum). */
const minRedundantReplicas = (k: NodeKind) => (k === "zookeeper" ? 3 : 2);

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
  /** Contended writes that skipped the lock, total and per node. */
  unsafe: number;
  unsafeByNode: Record<string, number>;
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

/** The original spec for nodes whose kind was replaced by its base behavior in `normalize`. */
const SPEC = new WeakMap<SimNode, ComponentSpec>();
function specOf(n: SimNode): ComponentSpec {
  return SPEC.get(n) ?? CATALOG[n.kind];
}

/**
 * Named services (Kafka, DynamoDB, ...) run as their base behavior. The rest of the engine only ever sees
 * base kinds, while specOf() still gives the service's own label, redundancy and kind for results.
 */
function normalize(graph: SimGraph): SimGraph {
  return {
    edges: graph.edges,
    nodes: graph.nodes.map((n) => {
      if (!CATALOG[n.kind]) return n;
      const spec = nodeSpec(n);
      if (spec.behavior === n.kind) return n;
      const out: SimNode = { ...n, kind: spec.behavior, label: n.label?.trim() || spec.label };
      SPEC.set(out, spec);
      return out;
    }),
  };
}

export function simulate(rawGraph: SimGraph, traffic: TrafficProfile): SimResult {
  const graph = normalize(rawGraph);
  const base = runCore(graph, traffic, {});
  const cleanTraffic = sanitizeTraffic(traffic);

  const bottlenecks = findBottlenecks(base, graph);
  const spofs = base.offered > 0 ? findSpofs(graph, cleanTraffic, base) : [];

  const behaviorById = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  let dbLoad = 0;
  let aiCalls = 0;
  for (const n of Object.values(base.nodes)) {
    const k = behaviorById.get(n.id) ?? behaviorOf(n.kind);
    if (DB_KINDS.has(k)) dbLoad += n.load;
    if (k === "llm") aiCalls += n.load;
  }

  const monthlyCost = graph.nodes.reduce((sum, n) => sum + nodeMonthlyCost({ kind: n.kind, config: sanitizeConfig(n.config) }), 0);

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
    unsafeWriteRps: base.unsafe,
    aiCallRps: aiCalls,
    monthlyCost,
    nodes: base.nodes,
    edgeFlows: base.edgeFlows,
    bottlenecks,
    spofs,
    issues: base.issues,
    idle: explainIdle(graph, cleanTraffic, base),
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
    if (NO_TRAFFIC_KINDS.has(s.kind) || NO_TRAFFIC_KINDS.has(t.kind)) continue;
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
    if (n.kind !== "client" && !NO_TRAFFIC_KINDS.has(n.kind) && !state.has(n.id)) {
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
    unsafe: 0,
    unsafeByNode: {},
    cacheLookups: 0,
    cacheHits: 0,
    nodes: {},
    edgeFlows: {},
    noRoute: [],
    issues,
  };
  for (const e of graph.edges) out.edgeFlows[e.id] = 0;
  /** Lock acquisitions per second sent to each lock node (side calls, not user traffic). */
  const lockLoad = new Map<string, number>();

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
    const spec = specOf(node);
    const cfg = sanitizeConfig(node.config);
    const b = inbound.get(id)!;

    const loadByClass: Record<TrafficClass, number> = { read: 0, write: 0, static: 0 };
    for (const cls of TRAFFIC_CLASSES) loadByClass[cls] = b.sync[cls].rps + b.async[cls].rps;
    if (SIDE_KINDS.has(node.kind)) loadByClass.write += lockLoad.get(id) ?? 0;
    const load = loadByClass.read + loadByClass.write + loadByClass.static;

    // Utilization: Σ load_c / capacity_c. SQL writes are limited to the primary. Indexes scale read/write capacity.
    const idx = INDEXABLE_KINDS.has(node.kind) ? INDEX_EFFECT[cfg.indexes ?? "standard"] : INDEX_EFFECT.standard;
    let utilization = 0;
    let totalCapacity: number | null = null;
    if (!spec.unlimited) {
      totalCapacity = cfg.capacity * cfg.replicas;
      for (const cls of TRAFFIC_CLASSES) {
        const raw = node.kind === "sqlDb" && cls === "write" ? cfg.capacity : totalCapacity;
        const cap = raw * (cls === "read" ? idx.read : cls === "write" ? idx.write : 1);
        if (loadByClass[cls] > 0) utilization += cap > 0 ? loadByClass[cls] / cap : Infinity;
      }
    }
    const isFailed = failed.has(id);
    const serveFrac = isFailed ? 0 : utilization <= 1 ? 1 : 1 / utilization;
    const latency = cfg.latencyMs * idx.latency * queueingFactor(utilization);

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

        let f: Flow = { rps: servedRps, latSum: inFlow.latSum * serveFrac + servedRps * latency };

        // Contended writes: take a lock first (side call), or run unsafely when no lock service is wired in.
        // Only the server handling the user's request (sync) does this, before it writes or enqueues. Writes
        // arriving later from a queue were already decided upstream, so they aren't counted a second time.
        if (mode === "sync" && cls === "write" && LOCK_TAKERS.has(node.kind) && traffic.contendedWriteFraction! > 0) {
          const contended = f.rps * traffic.contendedWriteFraction!;
          const locks = allKids.filter((k) => LOCK_KINDS.has(nodeById.get(k.target)!.kind));
          const live = locks.filter((k) => !failed.has(k.target));
          if (locks.length === 0) {
            out.unsafe += contended;
            out.unsafeByNode[id] = (out.unsafeByNode[id] ?? 0) + contended;
          } else if (live.length === 0) {
            // Fail closed: without a lock we refuse the write rather than risk a double booking.
            drop(mode, contended, true);
            dropped += contended;
            f = scale(f, 1 - traffic.contendedWriteFraction!);
          } else {
            const share = contended / live.length;
            for (const k of live) {
              lockLoad.set(k.target, (lockLoad.get(k.target) ?? 0) + share);
              if (k.edgeId) out.edgeFlows[k.edgeId] += share;
              f.latSum += share * sanitizeConfig(nodeById.get(k.target)!.config).latencyMs;
            }
          }
        }

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

        // AI requests: one model call each, made on the side. Fails if every connected model is down.
        if (cls !== "static" && AI_CALLERS.has(node.kind) && traffic.aiFraction! > 0) {
          const models = allKids.filter((k) => nodeById.get(k.target)!.kind === "llm");
          const live = models.filter((k) => !failed.has(k.target));
          const calls = f.rps * traffic.aiFraction!;
          if (models.length > 0 && live.length === 0) {
            drop(mode, calls, true);
            dropped += calls;
            f = scale(f, 1 - traffic.aiFraction!);
          } else if (live.length > 0) {
            const share = calls / live.length;
            for (const k of live) {
              lockLoad.set(k.target, (lockLoad.get(k.target) ?? 0) + share);
              if (k.edgeId) out.edgeFlows[k.edgeId] += share;
              f.latSum += share * sanitizeConfig(nodeById.get(k.target)!.config).latencyMs;
            }
          }
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

    // Side-call overload (locks, models): calls beyond capacity fail, and queueing slows the ones that got through.
    if (SIDE_KINDS.has(node.kind) && load > 0) {
      const ok = load * serveFrac;
      const lost = load - ok;
      if (lost > 0) {
        const avg = out.served > 0 ? out.servedLatSum / out.served : 0;
        out.errors += lost;
        out.served -= lost;
        out.servedLatSum -= lost * avg;
        dropped += lost;
      }
      out.servedLatSum += ok * (latency - cfg.latencyMs);
    }

    out.nodes[id] = {
      id,
      kind: spec.kind,
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
      kind: specOf(n).kind,
      load: 0,
      loadByClass: { read: 0, write: 0, static: 0 },
      capacity: specOf(n).unlimited ? null : cfg.capacity * cfg.replicas,
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
  switch (n.kind as BaseKind) {
    case "client":
    case "monitoring":
    case "codeRepo":
    case "ciPipeline":
    case "containerRegistry":
    case "llm":
    case "fineTune":
    case "redisLock":
    case "zookeeper":
      return false;
    case "dns":
      return true;
    case "worker":
      return cls === "write";
    case "loadBalancer":
    case "apiGateway":
    case "rateLimiter":
    case "appGateway":
    case "websocketGateway":
    case "appServer":
    case "serverless":
    case "objectStorage":
      return true;
    case "cdn":
      return cls === "static" || hasKids;
    case "cache":
      return cls === "read" || (cls === "write" && hasKids);
    case "sqlDb":
    case "nosqlDb":
    case "timeseriesDb":
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
    case "dns":
    case "loadBalancer":
    case "apiGateway":
    case "rateLimiter":
    case "appGateway":
    case "websocketGateway":
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
    case "serverless":
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
    case "worker":
      whenNoDownstream = "consume";
      groups = [ofKind((k) => DB_KINDS.has(k)), ofKind((k) => STORE_KINDS.has(k) && !DB_KINDS.has(k)), ofKind((k) => k === "cache")];
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
    const unindexed = INDEXABLE_KINDS.has(n.kind) && n.config.indexes === "none" && r.loadByClass.read > 0;
    const indexHint = unindexed ? " Reads are full table scans: add an index (Indexes → Standard)." : "";
    if (r.utilization > 1) {
      list.push({
        nodeId: n.id,
        severity: "crit",
        reason: `${nameOf(n.id)} is overloaded: ${fmt(r.load)} rps offered vs ${fmt(effectiveCapacity(r))} capacity, dropping ${fmt(r.droppedRps)} rps.${indexHint}`,
      });
    } else if (r.utilization >= WARN_UTILIZATION) {
      list.push({
        nodeId: n.id,
        severity: "warn",
        reason: `${nameOf(n.id)} is running hot at ${Math.round(r.utilization * 100)}% utilization, with little headroom for spikes.${indexHint}`,
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

  for (const [nodeId, rps] of Object.entries(core.unsafeByNode)) {
    list.push({
      nodeId,
      severity: "crit",
      reason: `${nameOf(nodeId)} sends ${fmt(rps)} rps of contended writes with no lock. Two users can grab the same item. Connect a Redis Lock or ZooKeeper.`,
    });
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
    const spec = specOf(n);
    if (spec.inherentlyRedundant) continue;
    if (sanitizeConfig(n.config).replicas >= minRedundantReplicas(n.kind)) continue;
    const r = base.nodes[n.id];
    if (!r || r.load <= 0) continue;
    const failedRun = runCore(graph, traffic, { failed: new Set([n.id]) });
    const lost = (failedRun.structuralErrors - base.structuralErrors) / base.offered;
    if (lost >= SPOF_THRESHOLD) {
      result.push({
        nodeId: n.id,
        trafficLost: lost,
        reason:
          n.kind === "zookeeper"
            ? `${displayName(n)} has ${sanitizeConfig(n.config).replicas} node(s). Losing one breaks quorum and ${Math.round(lost * 100)}% of traffic fails. Run 3 or 5 nodes.`
            : `If ${displayName(n)} fails, ${Math.round(lost * 100)}% of traffic has no path. Add replicas or a redundant peer.`,
      });
    }
  }
  return result;
}

/** Nodes that never forward traffic: anything linked *from* them gets nothing. */
const TERMINAL_KINDS: ReadonlySet<NodeKind> = new Set(["sqlDb", "nosqlDb", "timeseriesDb", "search", "objectStorage", "llm", "redisLock", "zookeeper"]);

/**
 * For each wired-in component with zero load, say why in plain words, most specific cause first.
 * Unconnected components are already reported as issues, so they are skipped here.
 */
function explainIdle(graph: SimGraph, traffic: TrafficProfile, core: CoreOutcome): IdleExplanation[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const reported = new Set(core.issues.map((i) => i.nodeId).filter(Boolean));
  const loadOf = (id: string) => core.nodes[id]?.load ?? 0;
  const writes = traffic.rps * (1 - traffic.staticFraction) * (1 - traffic.readRatio);
  const out: IdleExplanation[] = [];

  for (const n of graph.nodes) {
    if (n.kind === "client" || NO_TRAFFIC_KINDS.has(n.kind) || reported.has(n.id) || loadOf(n.id) > 0 || core.offered <= 0) continue;
    const parents = graph.edges
      .filter((e) => e.target === n.id && byId.has(e.source))
      .map((e) => byId.get(e.source)!)
      .filter((p) => !NO_TRAFFIC_KINDS.has(p.kind));
    if (parents.length === 0) continue;
    const name = displayName(n);
    const say = (reason: string) => out.push({ nodeId: n.id, reason });

    const terminal = parents.filter((p) => TERMINAL_KINDS.has(p.kind));
    if (terminal.length === parents.length) {
      const p = terminal[0];
      say(`${displayName(p)} → ${name} carries nothing: ${displayName(p)} never sends requests onward. Reverse the link (${name} → ${displayName(p)}).`);
    } else if ((n.kind === "queue" || n.kind === "worker") && writes <= 0) {
      say(`${name} only carries writes, and your traffic has none (read share is 100%). Lower Read share in Traffic.`);
    } else if (n.kind === "llm" && !(traffic.aiFraction! > 0)) {
      say(`No requests call a model. Set AI request share above 0% in Traffic.`);
    } else if (LOCK_KINDS.has(n.kind) && (!(traffic.contendedWriteFraction! > 0) || writes <= 0)) {
      say(`No writes are contended, so nothing takes a lock. Set Contended write share above 0% in Traffic.`);
    } else if ((n.kind === "llm" || LOCK_KINDS.has(n.kind)) && !parents.some((p) => AI_CALLERS.has(p.kind))) {
      say(`Only app servers, functions and workers call ${n.kind === "llm" ? "models" : "locks"}. Connect one of them to ${name}.`);
    } else if (parents.every((p) => loadOf(p.id) <= 0)) {
      say(`${displayName(parents[0])} gets no traffic itself, so ${name} gets none either.`);
    } else if (COMPUTE_KINDS.has(n.kind) && parents.some((p) => p.kind === "appServer" || p.kind === "serverless")) {
      say(`App servers send reads to caches and databases, and writes to queues and databases. They only forward to ${name} when they have none of those connected.`);
    } else if (n.kind === "worker" || COMPUTE_KINDS.has(n.kind)) {
      say(`Nothing routes to ${name}: ${displayName(parents[0])} sends its traffic to other components first.`);
    } else {
      say(`${displayName(parents[0])} sends its traffic elsewhere first (caches before databases, queues before databases).`);
    }
  }
  return out;
}

function deriveHealth(core: CoreOutcome, errorRate: number, bottlenecks: Bottleneck[]): Health {
  if (core.offered <= 0) return "idle";
  if (errorRate > 0.05 || core.served <= 0) return "critical";
  if (errorRate > 0.005 || core.backlog > 0 || core.unsafe > 0 || bottlenecks.length > 0) return "degraded";
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
    ...(c.indexes === "none" || c.indexes === "heavy" || c.indexes === "standard" ? { indexes: c.indexes } : {}),
  };
}

export function sanitizeTraffic(t: TrafficProfile): TrafficProfile {
  return {
    rps: nonNeg(t.rps),
    readRatio: clamp01(t.readRatio),
    hotKeyFraction: clamp01(t.hotKeyFraction),
    staticFraction: clamp01(t.staticFraction ?? 0),
    contendedWriteFraction: clamp01(t.contendedWriteFraction ?? 0),
    aiFraction: clamp01(t.aiFraction ?? 0),
  };
}

function displayName(n: SimNode): string {
  return n.label?.trim() || specOf(n).label;
}

function fmt(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}
