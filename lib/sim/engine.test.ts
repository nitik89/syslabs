import { describe, expect, it } from "vitest";
import { CATALOG, cacheHitRatio, simulate, type NodeConfig, type NodeKind, type SimGraph, type TrafficProfile } from "./index";

/* --------------------------- tiny graph builder --------------------------- */

function node(id: string, kind: NodeKind, overrides: Partial<NodeConfig> = {}) {
  return { id, kind, config: { ...CATALOG[kind].defaults, ...overrides } };
}
function edge(source: string, target: string) {
  return { id: `${source}-${target}`, source, target };
}

const readHeavy: TrafficProfile = { rps: 5000, readRatio: 1, hotKeyFraction: 0.9, staticFraction: 0 };

/** client -> lb -> app (x4) -> sql (cap 1000) */
function overloadedDb(): SimGraph {
  return {
    nodes: [node("c", "client"), node("lb", "loadBalancer"), node("app", "appServer", { replicas: 4 }), node("db", "sqlDb")],
    edges: [edge("c", "lb"), edge("lb", "app"), edge("app", "db")],
  };
}

const close = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

/* --------------------------------- tests --------------------------------- */

describe("determinism", () => {
  it("returns identical output for identical input", () => {
    const g = overloadedDb();
    const a = simulate(g, readHeavy);
    const b = simulate(structuredClone(g), { ...readHeavy });
    expect(b).toEqual(a);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("does not mutate its inputs", () => {
    const g = overloadedDb();
    const snapshot = structuredClone(g);
    simulate(g, readHeavy);
    expect(g).toEqual(snapshot);
  });
});

describe("caching", () => {
  it("adding a cache lowers DB load", () => {
    const without = simulate(overloadedDb(), readHeavy);

    const g = overloadedDb();
    g.nodes.push(node("cache", "cache", { cacheSizeGb: 16 }));
    g.edges.push(edge("app", "cache"));
    const withCache = simulate(g, readHeavy);

    expect(withCache.dbLoadRps).toBeLessThan(without.dbLoadRps);
    expect(withCache.cacheHitRatio).not.toBeNull();
    expect(withCache.errorRate).toBeLessThan(without.errorRate);
    // Cache-aside: misses reach the DB via the app's existing DB connection.
    expect(close(withCache.dbLoadRps, 5000 * (1 - withCache.cacheHitRatio!))).toBe(true);
  });

  it("hit ratio grows with hot-key fraction and cache size", () => {
    expect(cacheHitRatio(0.9, 8)).toBeGreaterThan(cacheHitRatio(0.2, 8));
    expect(cacheHitRatio(0.9, 32)).toBeGreaterThan(cacheHitRatio(0.9, 4));
    expect(cacheHitRatio(1, 1000)).toBeLessThanOrEqual(0.98);
    expect(cacheHitRatio(0.5, 0)).toBe(0);
  });
});

describe("capacity", () => {
  it("adding replicas raises capacity", () => {
    const g1 = overloadedDb();
    const r1 = simulate(g1, readHeavy);

    const g2 = overloadedDb();
    g2.nodes.find((n) => n.id === "db")!.config.replicas = 6;
    const r2 = simulate(g2, readHeavy);

    expect(r2.nodes.db.capacity).toBe(r1.nodes.db.capacity! * 6);
    expect(r2.servedRps).toBeGreaterThan(r1.servedRps);
    expect(r2.nodes.db.utilization).toBeLessThan(r1.nodes.db.utilization);
  });

  it("SQL read replicas do not add write capacity", () => {
    const writes: TrafficProfile = { rps: 2000, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 };
    const g = overloadedDb();
    g.nodes.find((n) => n.id === "db")!.config.replicas = 5;
    const r = simulate(g, writes);
    expect(r.nodes.db.utilization).toBeCloseTo(2, 6);
    expect(r.errorRps).toBeCloseTo(1000, 6);
  });

  it("overloaded nodes produce errors and a critical bottleneck", () => {
    const r = simulate(overloadedDb(), readHeavy);
    expect(r.nodes.db.utilization).toBeCloseTo(5, 6);
    expect(r.nodes.db.status).toBe("crit");
    expect(r.errorRps).toBeCloseTo(4000, 6);
    expect(r.errorRate).toBeCloseTo(0.8, 6);
    expect(r.health).toBe("critical");
    expect(r.bottlenecks[0]).toMatchObject({ nodeId: "db", severity: "crit" });
  });

  it("conserves traffic: served + errors = offered", () => {
    for (const rps of [100, 1000, 5000, 20000]) {
      const r = simulate(overloadedDb(), { ...readHeavy, rps, readRatio: 0.7 });
      expect(close(r.servedRps + r.errorRps, r.offeredRps)).toBe(true);
    }
  });

  it("latency increases with utilization", () => {
    const low = simulate(overloadedDb(), { ...readHeavy, rps: 200 });
    const high = simulate(overloadedDb(), { ...readHeavy, rps: 900 });
    expect(high.avgLatencyMs!).toBeGreaterThan(low.avgLatencyMs!);
  });
});

describe("routing", () => {
  it("load balancer splits evenly across downstream servers", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("lb", "loadBalancer"), node("a1", "appServer"), node("a2", "appServer")],
      edges: [edge("c", "lb"), edge("lb", "a1"), edge("lb", "a2")],
    };
    const r = simulate(g, { rps: 1000, readRatio: 0.5, hotKeyFraction: 0, staticFraction: 0 });
    expect(r.nodes.a1.load).toBeCloseTo(500, 6);
    expect(r.nodes.a2.load).toBeCloseTo(500, 6);
    expect(r.edgeFlows["lb-a1"]).toBeCloseTo(500, 6);
  });

  it("CDN absorbs static traffic", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("cdn", "cdn"), node("lb", "loadBalancer"), node("app", "appServer")],
      edges: [edge("c", "cdn"), edge("c", "lb"), edge("lb", "app")],
    };
    const r = simulate(g, { rps: 1000, readRatio: 1, hotKeyFraction: 0, staticFraction: 0.6 });
    expect(r.nodes.cdn.load).toBeCloseTo(600, 6);
    expect(r.nodes.app.load).toBeCloseTo(400, 6);
  });

  it("queue buffers writes asynchronously: errors become backlog, latency excludes DB", () => {
    const writes: TrafficProfile = { rps: 3000, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 };
    const direct = simulate(overloadedDb(), writes);

    const g = overloadedDb();
    g.nodes.push(node("q", "queue"));
    g.edges = g.edges.filter((e) => e.id !== "app-db");
    g.edges.push(edge("app", "q"), edge("q", "db"));
    const queued = simulate(g, writes);

    expect(direct.errorRps).toBeGreaterThan(0);
    expect(queued.errorRps).toBe(0);
    expect(queued.backlogRps).toBeCloseTo(2000, 6);
    expect(queued.nodes.db.load).toBeCloseTo(3000, 6);
    expect(queued.health).toBe("degraded");
  });

  it("reports missing routes as errors", () => {
    const g: SimGraph = { nodes: [node("c", "client"), node("lb", "loadBalancer")], edges: [edge("c", "lb")] };
    const r = simulate(g, { rps: 100, readRatio: 1, hotKeyFraction: 0, staticFraction: 0 });
    expect(r.errorRate).toBe(1);
    expect(r.bottlenecks.some((b) => b.nodeId === "lb" && b.reason.includes("nowhere"))).toBe(true);
  });

  it("ignores cycles without hanging and reports them", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("a", "appServer"), node("b", "loadBalancer")],
      edges: [edge("c", "b"), edge("b", "a"), edge("a", "b")],
    };
    const r = simulate(g, { rps: 100, readRatio: 1, hotKeyFraction: 0, staticFraction: 0 });
    expect(r.issues.some((i) => i.message.includes("loop"))).toBe(true);
    expect(r.servedRps).toBeCloseTo(100, 6);
  });
});

describe("reliability", () => {
  it("flags a single app server as a SPOF, and not when replicated", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("app", "appServer"), node("db", "nosqlDb", { replicas: 2 })],
      edges: [edge("c", "app"), edge("app", "db")],
    };
    const t: TrafficProfile = { rps: 500, readRatio: 0.8, hotKeyFraction: 0, staticFraction: 0 };
    expect(simulate(g, t).spofs.map((s) => s.nodeId)).toEqual(["app"]);

    g.nodes[1].config.replicas = 2;
    expect(simulate(g, t).spofs).toEqual([]);
  });

  it("two peers behind a load balancer are not SPOFs, but the single LB is", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("lb", "loadBalancer"), node("a1", "appServer"), node("a2", "appServer")],
      edges: [edge("c", "lb"), edge("lb", "a1"), edge("lb", "a2")],
    };
    const r = simulate(g, { rps: 500, readRatio: 1, hotKeyFraction: 0, staticFraction: 0 });
    expect(r.spofs.map((s) => s.nodeId)).toEqual(["lb"]);
  });
});

describe("cost and edge cases", () => {
  it("sums cost per replica", () => {
    const r = simulate(overloadedDb(), readHeavy);
    const expected = 0 + 25 + 70 * 4 + 200;
    expect(r.monthlyCost).toBe(expected);
  });

  it("an empty graph is idle with no errors", () => {
    const r = simulate({ nodes: [], edges: [] }, readHeavy);
    expect(r.health).toBe("idle");
    expect(r.offeredRps).toBe(0);
    expect(r.avgLatencyMs).toBeNull();
  });

  it("sanitizes nonsense config instead of producing NaN", () => {
    const g = overloadedDb();
    g.nodes[2].config = { capacity: -5, latencyMs: Number.NaN, replicas: 0, costPerReplica: -1 };
    const r = simulate(g, readHeavy);
    expect(Number.isNaN(r.errorRate)).toBe(false);
    expect(Number.isNaN(r.monthlyCost)).toBe(false);
    expect(r.errorRate).toBe(1);
  });
});

describe("failure semantics", () => {
  const t: TrafficProfile = { rps: 500, readRatio: 1, hotKeyFraction: 0.9, staticFraction: 0 };

  it("an app server does not answer reads itself when its only database is down", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 2 }), node("db", "nosqlDb")],
      edges: [edge("c", "app"), edge("app", "db")],
    };
    expect(simulate(g, t).spofs.map((s) => s.nodeId)).toEqual(["db"]);
  });

  it("a failed cache falls back to the database, so it is not a SPOF", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 2 }), node("cache", "cache"), node("db", "nosqlDb", { replicas: 2 })],
      edges: [edge("c", "app"), edge("app", "cache"), edge("app", "db")],
    };
    expect(simulate(g, t).spofs).toEqual([]);
  });

  it("an app server with no downstream still serves traffic itself", () => {
    const g: SimGraph = { nodes: [node("c", "client"), node("app", "appServer")], edges: [edge("c", "app")] };
    const r = simulate(g, t);
    expect(r.servedRps).toBeCloseTo(500, 6);
    expect(r.errorRps).toBe(0);
  });
});
