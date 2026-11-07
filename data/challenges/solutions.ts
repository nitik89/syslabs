import { CATALOG, type NodeConfig, type NodeKind, type SimGraph } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";

/* Reference solutions for the fix-it challenges. Shown only when the player asks to reveal one. */

export function n(id: string, kind: NodeKind, o: Partial<NodeConfig> = {}) {
  return { id, kind, config: { ...CATALOG[kind].defaults, ...o } };
}
export function chain(...pairs: Array<[string, string]>) {
  return pairs.map(([s, t]) => ({ id: `e:${s}->${t}`, source: s, target: t }));
}

export function concert(lock: "redisLock" | "zookeeper", replicas: number): SimGraph {
  return {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 3 }),
      n("appServer-1", "appServer", { replicas: 30 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 4 }),
      n("lock-1", lock, { replicas }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "nosqlDb-1"], ["appServer-1", "lock-1"]),
  };
}

/** One passing design per challenge. */
export const SOLUTIONS: Record<string, SimGraph> = {
  "overloaded-database": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer"),
      n("appServer-1", "appServer", { replicas: 5 }),
      n("sqlDb-1", "sqlDb"),
      n("cache-1", "cache", { cacheSizeGb: 32 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "sqlDb-1"], ["appServer-1", "cache-1"]),
  },
  "single-point-of-failure": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 2 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "cloud-bill-shock": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 2 }),
      n("sqlDb-1", "sqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "sqlDb-1"]),
  },
  "flash-sale-checkout": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 8 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("queue-1", "queue", { replicas: 2 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(
      ["client-1", "loadBalancer-1"],
      ["loadBalancer-1", "appServer-1"],
      ["appServer-1", "cache-1"],
      ["appServer-1", "queue-1"],
      ["appServer-1", "nosqlDb-1"],
      ["queue-1", "nosqlDb-1"],
    ),
  },
  "image-heavy-homepage": {
    nodes: [
      n("client-1", "client"),
      n("cdn-1", "cdn"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 6 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("sqlDb-1", "sqlDb", { replicas: 4 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "cdn-1"], ["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "sqlDb-1"]),
  },
  "live-scoreboard": {
    nodes: [
      n("client-1", "client"),
      n("cdn-1", "cdn"),
      n("loadBalancer-1", "loadBalancer", { replicas: 3 }),
      n("appServer-1", "appServer", { replicas: 40 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "cdn-1"], ["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "url-shortener": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 12 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "double-booked-seats": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 3 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("sqlDb-1", "sqlDb", { replicas: 2 }),
      n("redisLock-1", "redisLock", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "sqlDb-1"], ["appServer-1", "redisLock-1"]),
  },
  "lost-quorum": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 6 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("zookeeper-1", "zookeeper", { replicas: 3 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "nosqlDb-1"], ["appServer-1", "zookeeper-1"]),
  },
  "write-storm": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 4 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "choked-front-door": {
    nodes: [
      n("client-1", "client"),
      n("apiGateway-1", "apiGateway", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 12 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "apiGateway-1"], ["apiGateway-1", "appServer-1"], ["appServer-1", "cache-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "cache-that-didnt-help": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 3 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "inbox-never-drains": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 6 }),
      n("queue-1", "queue", { replicas: 2 }),
      n("worker-1", "worker", { replicas: 4 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "queue-1"], ["queue-1", "worker-1"], ["worker-1", "nosqlDb-1"], ["appServer-1", "nosqlDb-1"]),
  },
  "photo-sharing-launch": {
    nodes: [
      n("client-1", "client"),
      n("cdn-1", "cdn"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 6 }),
      n("cache-1", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("queue-1", "queue", { replicas: 2 }),
      n("nosqlDb-1", "nosqlDb", { replicas: 2 }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(
      ["client-1", "cdn-1"],
      ["client-1", "loadBalancer-1"],
      ["loadBalancer-1", "appServer-1"],
      ["appServer-1", "cache-1"],
      ["appServer-1", "queue-1"],
      ["queue-1", "nosqlDb-1"],
      ["appServer-1", "nosqlDb-1"],
    ),
  },
  "concert-ticket-drop": concert("redisLock", 2),
  "missing-index": {
    nodes: [
      n("client-1", "client"),
      n("loadBalancer-1", "loadBalancer", { replicas: 2 }),
      n("appServer-1", "appServer", { replicas: 2 }),
      n("sqlDb-1", "sqlDb", { replicas: 3, indexes: "standard" }),
      n("monitoring-1", "monitoring"),
    ],
    edges: chain(["client-1", "loadBalancer-1"], ["loadBalancer-1", "appServer-1"], ["appServer-1", "sqlDb-1"]),
  },
};

/** Left-to-right layout: column = distance from the users, unreached nodes (monitoring) go below. */
export function layout(g: SimGraph): DesignDoc["positions"] {
  const depth = new Map<string, number>();
  const queue = g.nodes.filter((x) => x.kind === "client").map((x) => x.id);
  for (const id of queue) depth.set(id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of g.edges)
      if (e.source === id && !depth.has(e.target)) {
        depth.set(e.target, depth.get(id)! + 1);
        queue.push(e.target);
      }
  }
  const rows = new Map<number, number>();
  const maxRows = Math.max(1, ...[...depth.values()].map((d) => [...depth.values()].filter((x) => x === d).length));
  let spare = 0;
  const pos: DesignDoc["positions"] = {};
  for (const node of g.nodes) {
    const d = depth.get(node.id);
    if (d === undefined) {
      pos[node.id] = { x: spare++ * 250, y: maxRows * 140 + 40 };
      continue;
    }
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    pos[node.id] = { x: d * 250, y: row * 140 };
  }
  return pos;
}

export function solutionFor(id: string): Omit<DesignDoc, "traffic"> | undefined {
  const graph = SOLUTIONS[id];
  return graph && { graph, positions: layout(graph) };
}
