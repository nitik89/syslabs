import { describe, expect, it } from "vitest";
import { CATALOG, NODE_KINDS, simulate, type NodeConfig, type NodeKind, type SimGraph } from "@/lib/sim";
import { scoreChallenge } from "@/lib/challenges/score";
import { CHALLENGES, getChallenge } from "./index";

/* ------------------------------ helpers ------------------------------ */

function n(id: string, kind: NodeKind, o: Partial<NodeConfig> = {}) {
  return { id, kind, config: { ...CATALOG[kind].defaults, ...o } };
}
function chain(...pairs: Array<[string, string]>) {
  return pairs.map(([s, t]) => ({ id: `e:${s}->${t}`, source: s, target: t }));
}
function run(id: string, graph: SimGraph) {
  const ch = getChallenge(id)!;
  const r = simulate(graph, ch.traffic);
  return { r, s: scoreChallenge(ch, r, graph) };
}

function concert(lock: "redisLock" | "zookeeper", replicas: number): SimGraph {
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

/** Reference solutions (kept out of the shipped JSON so hints stay meaningful). */
const SOLUTIONS: Record<string, SimGraph> = {
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

/* ------------------------------- tests ------------------------------- */

describe("challenge data", () => {
  it("ships every challenge in order with unique ids and a reference solution", () => {
    expect(CHALLENGES.map((c) => c.id)).toEqual([
      "overloaded-database",
      "single-point-of-failure",
      "url-shortener",
      "cloud-bill-shock",
      "flash-sale-checkout",
      "image-heavy-homepage",
      "live-scoreboard",
      "double-booked-seats",
      "lost-quorum",
      "write-storm",
      "choked-front-door",
      "cache-that-didnt-help",
      "inbox-never-drains",
      "photo-sharing-launch",
      "concert-ticket-drop",
      "missing-index",
    ]);
    expect(new Set(CHALLENGES.map((c) => c.order)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) expect(SOLUTIONS[c.id]).toBeDefined();
  });

  for (const ch of CHALLENGES) {
    describe(ch.id, () => {
      it("is well-formed", () => {
        expect(ch.title.length).toBeGreaterThan(3);
        expect(ch.scenario.length).toBeGreaterThan(0);
        expect(ch.objectives.length).toBeGreaterThan(0);
        expect(ch.hints).toHaveLength(3);
        expect(ch.explanation.length).toBeGreaterThan(0);
        expect(ch.allowedComponents.every((k) => (NODE_KINDS as readonly string[]).includes(k))).toBe(true);
        const w = ch.scoring.weights;
        expect(w.performance + w.reliability + w.cost + w.architecture).toBeCloseTo(1, 6);
        const ids = new Set(ch.startingDesign.graph.nodes.map((x) => x.id));
        for (const e of ch.startingDesign.graph.edges) {
          expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
        }
        for (const node of ch.startingDesign.graph.nodes) {
          expect(ch.allowedComponents).toContain(node.kind);
          expect(ch.startingDesign.positions[node.id]).toBeDefined();
        }
      });

      it("starting design fails its objectives", () => {
        const { s } = run(ch.id, ch.startingDesign.graph);
        expect(s.passed).toBe(false);
      });

      it("reference solution passes every objective with a high score", () => {
        const { s } = run(ch.id, SOLUTIONS[ch.id]);
        const failing = s.objectives.filter((o) => !o.met).map((o) => `${o.objective.id}=${o.actual}`);
        expect(failing).toEqual([]);
        expect(s.passed).toBe(true);
        expect(s.total).toBeGreaterThanOrEqual(75);
      });
    });
  }
});

describe("scoring", () => {
  it("is deterministic and bounded", () => {
    const g = SOLUTIONS["url-shortener"];
    const a = run("url-shortener", g).s;
    const b = run("url-shortener", structuredClone(g)).s;
    expect(b).toEqual(a);
    for (const c of a.categories) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it("the overloaded starting design scores poorly on performance", () => {
    const { s, r } = run("overloaded-database", getChallenge("overloaded-database")!.startingDesign.graph);
    expect(r.errorRate).toBeGreaterThan(0.5);
    expect(s.categories.find((c) => c.category === "performance")!.score).toBeLessThan(40);
  });

  it("a small cache is not enough for challenge 1 (size matters)", () => {
    const g = structuredClone(SOLUTIONS["overloaded-database"]);
    g.nodes.find((x) => x.id === "cache-1")!.config.cacheSizeGb = 8;
    const { s } = run("overloaded-database", g);
    expect(s.objectives.find((o) => o.objective.id === "db")!.met).toBe(false);
  });

  it("an empty canvas scores zero and does not pass", () => {
    const { s } = run("url-shortener", { nodes: [], edges: [] });
    expect(s.total).toBe(0);
    expect(s.passed).toBe(false);
  });

  it("an unprotected load balancer is caught as a SPOF in challenge 2", () => {
    const g = structuredClone(SOLUTIONS["single-point-of-failure"]);
    g.nodes.find((x) => x.id === "loadBalancer-1")!.config.replicas = 1;
    const { s } = run("single-point-of-failure", g);
    expect(s.objectives.find((o) => o.objective.id === "spof")!.met).toBe(false);
  });
});

describe("scoring regressions", () => {
  it("a design that serves nothing cannot earn reliability or cost points", () => {
    const { s } = run("url-shortener", { nodes: [n("client-1", "client")], edges: [] });
    const by = Object.fromEntries(s.categories.map((c) => [c.category, c.score]));
    expect(by.reliability).toBe(0);
    expect(by.cost).toBe(0);
    expect(s.total).toBeLessThan(15);
  });
});

describe("new challenges teach what they claim", () => {
  const scoreboard = (apps: number) => ({
    nodes: [
      n("c", "client"),
      n("cdn", "cdn"),
      n("lb", "loadBalancer", { replicas: 3 }),
      n("a", "appServer", { replicas: apps }),
      n("k", "cache", { replicas: 2, cacheSizeGb: 32 }),
      n("d", "nosqlDb", { replicas: 2 }),
      n("m", "monitoring"),
    ],
    edges: chain(["c", "cdn"], ["c", "lb"], ["lb", "a"], ["a", "k"], ["a", "d"]),
  });

  it("scoreboard: the cheapest fleet that fits capacity is too slow", () => {
    const { s } = run("live-scoreboard", scoreboard(32));
    expect(s.objectives.find((o) => o.objective.id === "latency")!.met).toBe(false);
    expect(run("live-scoreboard", scoreboard(40)).s.passed).toBe(true);
  });

  it("flash sale: a queue in front of Postgres just builds a backlog", () => {
    const g: SimGraph = {
      nodes: [
        n("c", "client"),
        n("lb", "loadBalancer", { replicas: 2 }),
        n("a", "appServer", { replicas: 8 }),
        n("k", "cache", { replicas: 2, cacheSizeGb: 32 }),
        n("q", "queue", { replicas: 2 }),
        n("s", "sqlDb", { replicas: 3 }),
        n("m", "monitoring"),
      ],
      edges: chain(["c", "lb"], ["lb", "a"], ["a", "k"], ["a", "q"], ["a", "s"], ["q", "s"]),
    };
    const { r, s } = run("flash-sale-checkout", g);
    expect(r.backlogRps).toBeGreaterThan(2000);
    expect(s.passed).toBe(false);
  });

  it("image homepage: a CDN alone moves the bottleneck to the database", () => {
    const start = getChallenge("image-heavy-homepage")!.startingDesign.graph;
    const g: SimGraph = { nodes: [...start.nodes, n("cdn-1", "cdn")], edges: [...start.edges, { id: "x", source: "client-1", target: "cdn-1" }] };
    const { r } = run("image-heavy-homepage", g);
    expect(r.nodes["appServer-1"].utilization).toBeLessThan(0.8);
    expect(r.bottlenecks[0]).toMatchObject({ nodeId: "sqlDb-1", severity: "crit" });
  });

  it("cloud bill: the starting stack works but costs far too much", () => {
    const { s, r } = run("cloud-bill-shock", getChallenge("cloud-bill-shock")!.startingDesign.graph);
    expect(r.errorRate).toBe(0);
    expect(s.objectives.filter((o) => !o.met).map((o) => o.objective.id)).toEqual(["cost"]);
  });
});

describe("design-flaw challenges teach what they claim", () => {
  const with_ = (id: string, f: (g: SimGraph) => void) => {
    const g = structuredClone(SOLUTIONS[id]);
    f(g);
    return run(id, g);
  };
  const cfg = (g: SimGraph, id: string) => g.nodes.find((x) => x.id === id)!.config;
  const unmet = (s: ReturnType<typeof run>["s"]) => s.objectives.filter((o) => !o.met).map((o) => o.objective.id);

  it("seats: the starting design double-books without erroring", () => {
    const { r, s } = run("double-booked-seats", getChallenge("double-booked-seats")!.startingDesign.graph);
    expect(r.errorRate).toBe(0);
    expect(r.unsafeWriteRps).toBeGreaterThan(0);
    expect(unmet(s)).toEqual(["unsafe"]);
    expect(s.categories.find((c) => c.category === "reliability")!.notes.join(" ")).toMatch(/without a lock/);
  });

  it("seats: a single Redis lock fixes the race but becomes a SPOF (fail closed)", () => {
    const { r, s } = with_("double-booked-seats", (g) => (cfg(g, "redisLock-1").replicas = 1));
    expect(r.unsafeWriteRps).toBe(0);
    expect(r.spofs.map((x) => x.nodeId)).toEqual(["redisLock-1"]);
    expect(unmet(s)).toEqual(["spof"]);
  });

  it("seats: a 3-node ZooKeeper also passes", () => {
    const { s } = with_("double-booked-seats", (g) => {
      g.nodes = g.nodes.filter((x) => x.id !== "redisLock-1").concat(n("zk", "zookeeper"));
      g.edges = g.edges.filter((e) => e.target !== "redisLock-1").concat(chain(["appServer-1", "zk"]));
    });
    expect(s.passed).toBe(true);
  });

  it("quorum: 2 ZooKeeper nodes are a SPOF, 4 waste money", () => {
    expect(unmet(run("lost-quorum", getChallenge("lost-quorum")!.startingDesign.graph).s)).toEqual(["spof"]);
    expect(unmet(with_("lost-quorum", (g) => (cfg(g, "zookeeper-1").replicas = 4)).s)).toEqual(["cost"]);
  });

  it("write storm: more SQL read replicas don't add write capacity", () => {
    const start = getChallenge("write-storm")!.startingDesign.graph;
    const more = structuredClone(start);
    cfg(more, "sqlDb-1").replicas = 6;
    expect(run("write-storm", more).r.errorRate).toBeCloseTo(run("write-storm", start).r.errorRate, 1);
  });

  it("cache that didn't help: replicas plus the useless cache blow the budget", () => {
    const g = structuredClone(getChallenge("cache-that-didnt-help")!.startingDesign.graph);
    cfg(g, "sqlDb-1").replicas = 3;
    const { r, s } = run("cache-that-didnt-help", g);
    expect(r.cacheHitRatio!).toBeLessThan(0.4);
    expect(unmet(s)).toEqual(["cost"]);
  });

  it("inbox: 3 workers drain the queue but leave no headroom", () => {
    const { r, s } = with_("inbox-never-drains", (g) => (cfg(g, "worker-1").replicas = 3));
    expect(r.backlogRps).toBe(0);
    expect(unmet(s)).toEqual(["headroom"]);
    expect(run("inbox-never-drains", getChallenge("inbox-never-drains")!.startingDesign.graph).r.backlogRps).toBeGreaterThan(2000);
  });

  it("concert: ZooKeeper is safe but too slow at this volume", () => {
    const { r, s } = run("concert-ticket-drop", concert("zookeeper", 3));
    expect(r.unsafeWriteRps).toBe(0);
    expect(unmet(s)).toEqual(["latency"]);
  });
});

describe("named services in challenges", () => {
  it("are allowed wherever their base behavior is, and score like it", () => {
    const g = structuredClone(SOLUTIONS["inbox-never-drains"]);
    g.nodes = g.nodes.map((x) => (x.id === "queue-1" ? n("queue-1", "sqs") : x.id === "monitoring-1" ? n("monitoring-1", "prometheus") : x));
    const { s } = run("inbox-never-drains", g);
    expect(s.categories.find((c) => c.category === "architecture")!.notes).toEqual([]);
    expect(s.passed).toBe(true);
  });
});

describe("missing index", () => {
  const unmet = (s: ReturnType<typeof run>["s"]) => s.objectives.filter((o) => !o.met).map((o) => o.objective.id);
  it("the start overloads the DB, and the bottleneck says to add an index", () => {
    const { r } = run("missing-index", getChallenge("missing-index")!.startingDesign.graph);
    expect(r.errorRate).toBeGreaterThan(0.3);
    expect(r.bottlenecks[0].reason).toMatch(/full table scans: add an index/);
  });
  it("throwing replicas at full scans blows the budget; a cache alone isn't enough", () => {
    const g = structuredClone(SOLUTIONS["missing-index"]);
    const db = g.nodes.find((x) => x.id === "sqlDb-1")!.config;
    db.indexes = "none";
    db.replicas = 14;
    expect(unmet(run("missing-index", g).s)).toContain("cost");
    const cached = structuredClone(getChallenge("missing-index")!.startingDesign.graph);
    cached.nodes.push(n("cache-1", "cache", { replicas: 2, cacheSizeGb: 64 }));
    cached.edges.push({ id: "x", source: "appServer-1", target: "cache-1" });
    expect(run("missing-index", cached).s.passed).toBe(false);
  });
  it("heavy indexes pass too, but cost write capacity", () => {
    const g = structuredClone(SOLUTIONS["missing-index"]);
    g.nodes.find((x) => x.id === "sqlDb-1")!.config.indexes = "heavy";
    const { r, s } = run("missing-index", g);
    expect(s.passed).toBe(true);
    expect(r.nodes["sqlDb-1"].utilization).toBeLessThan(run("missing-index", SOLUTIONS["missing-index"]).r.nodes["sqlDb-1"].utilization);
  });
});
