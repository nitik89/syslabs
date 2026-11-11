import { describe, expect, it } from "vitest";
import { BASE_KINDS, CATALOG, NODE_KINDS, analyzePipeline, cacheHitRatio, nodeSpec, simulate, type NodeConfig, type NodeKind, type SimGraph, type TrafficProfile } from "./index";

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
    g.nodes.push(node("q", "queue"), node("w", "worker", { capacity: 10_000 }));
    g.edges = g.edges.filter((e) => e.id !== "app-db");
    g.edges.push(edge("app", "q"), edge("q", "w"), edge("w", "db"));
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

describe("coordination, entry and compute components", () => {
  const booking: TrafficProfile = { rps: 1000, readRatio: 0.5, hotKeyFraction: 0.5, staticFraction: 0, contendedWriteFraction: 1 };
  const shop = (extra: ReturnType<typeof node>[] = [], extraEdges: ReturnType<typeof edge>[] = []): SimGraph => ({
    nodes: [node("c", "client"), node("app", "appServer", { replicas: 2 }), node("db", "nosqlDb", { replicas: 2 }), ...extra],
    edges: [edge("c", "app"), edge("app", "db"), ...extraEdges],
  });

  it("contended writes without a lock are unsafe and flagged on the app server", () => {
    const r = simulate(shop(), booking);
    expect(r.unsafeWriteRps).toBeCloseTo(500);
    expect(r.errorRate).toBe(0);
    expect(r.bottlenecks.some((b) => b.nodeId === "app" && /no lock/.test(b.reason))).toBe(true);
    expect(r.health).toBe("degraded");
  });

  it("a lock makes them safe, adds its latency, and carries lock load", () => {
    const base = simulate(shop(), booking);
    const r = simulate(shop([node("l", "redisLock", { replicas: 2 })], [edge("app", "l")]), booking);
    expect(r.unsafeWriteRps).toBe(0);
    expect(r.nodes.l.load).toBeCloseTo(500);
    expect(r.avgLatencyMs!).toBeGreaterThan(base.avgLatencyMs!);
    // Locks never receive user traffic: reads still go to the DB.
    expect(r.nodes.db.load).toBeCloseTo(1000);
  });

  it("locks fail closed: a single lock is a SPOF", () => {
    const r = simulate(shop([node("l", "redisLock")], [edge("app", "l")]), booking);
    expect(r.spofs.map((s) => s.nodeId)).toEqual(["l"]);
  });

  it("ZooKeeper needs 3 nodes to survive a failure", () => {
    const zk = (replicas: number) => simulate(shop([node("z", "zookeeper", { replicas })], [edge("app", "z")]), booking);
    expect(zk(2).spofs.map((s) => s.nodeId)).toEqual(["z"]);
    expect(zk(3).spofs).toEqual([]);
  });

  it("an overloaded lock fails the excess writes", () => {
    const r = simulate(shop([node("l", "redisLock", { capacity: 250, replicas: 2 })], [edge("app", "l")]), booking);
    expect(r.nodes.l.utilization).toBeCloseTo(1);
    const over = simulate(shop([node("l", "redisLock", { capacity: 100, replicas: 2 })], [edge("app", "l")]), booking);
    expect(over.errorRps).toBeCloseTo(300);
  });

  it("DNS is a managed pass-through and never a SPOF", () => {
    const r = simulate(
      { nodes: [node("c", "client"), node("d", "dns"), node("lb", "loadBalancer", { replicas: 2 }), node("app", "appServer", { replicas: 2 })], edges: [edge("c", "d"), edge("d", "lb"), edge("lb", "app")] },
      readHeavy,
    );
    expect(r.nodes.lb.load).toBeCloseTo(5000);
    expect(r.spofs.map((s) => s.nodeId)).not.toContain("d");
  });

  it("a background worker drains a queue at its own capacity", () => {
    const writes: TrafficProfile = { rps: 3000, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 };
    const g = (w: number): SimGraph => ({
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 3 }), node("q", "queue"), node("w", "worker", { replicas: w }), node("db", "nosqlDb")],
      edges: [edge("c", "app"), edge("app", "q"), edge("q", "w"), edge("w", "db")],
    });
    expect(simulate(g(1), writes).backlogRps).toBeCloseTo(1000);
    expect(simulate(g(2), writes).backlogRps).toBe(0);
    expect(simulate(g(2), writes).nodes.db.load).toBeCloseTo(3000);
  });

  it("serverless acts like an app server but is never a SPOF", () => {
    const r = simulate({ nodes: [node("c", "client"), node("f", "serverless"), node("db", "nosqlDb", { replicas: 2 })], edges: [edge("c", "f"), edge("f", "db")] }, booking);
    expect(r.nodes.db.load).toBeCloseTo(1000);
    expect(r.spofs).toEqual([]);
    expect(r.unsafeWriteRps).toBeCloseTo(500);
  });

  it("a rate limiter caps what reaches the backend", () => {
    const r = simulate(
      { nodes: [node("c", "client"), node("rl", "rateLimiter", { capacity: 4000, replicas: 1 }), node("app", "appServer", { replicas: 3 })], edges: [edge("c", "rl"), edge("rl", "app")] },
      readHeavy,
    );
    expect(r.errorRps).toBeCloseTo(1000);
    expect(r.nodes.app.load).toBeCloseTo(4000);
  });

  it("time-series DB counts as database load and scales writes", () => {
    const writes: TrafficProfile = { rps: 12000, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 };
    const r = simulate({ nodes: [node("c", "client"), node("app", "appServer", { replicas: 10 }), node("t", "timeseriesDb")], edges: [edge("c", "app"), edge("app", "t")] }, writes);
    expect(r.dbLoadRps).toBeCloseTo(12000);
    expect(r.errorRate).toBe(0);
  });
});

describe("named services run as their base behavior", () => {
  const writes: TrafficProfile = { rps: 3000, readRatio: 0.2, hotKeyFraction: 0.5, staticFraction: 0 };
  const pipeline = (queue: NodeKind, db: NodeKind): SimGraph => ({
    nodes: [node("c", "client"), node("lb", "awsAlb"), node("app", "kubernetes"), node("q", queue), node("w", "celery", { replicas: 2 }), node("db", db, { replicas: 2 })],
    edges: [edge("c", "lb"), edge("lb", "app"), edge("app", "q"), edge("q", "w"), edge("w", "db"), edge("app", "db")],
  });

  it("every service maps to a real base behavior and keeps its own kind in results", () => {
    for (const k of NODE_KINDS) expect(BASE_KINDS as readonly string[]).toContain(CATALOG[k].behavior);
    const r = simulate(pipeline("kafka", "cassandra"), writes);
    expect(r.nodes.q.kind).toBe("kafka");
    expect(r.nodes.db.kind).toBe("cassandra");
    expect(r.dbLoadRps).toBeCloseTo(3000);
    expect(r.backlogRps).toBe(0);
  });

  it("managed services are never SPOFs; self-hosted ones with one replica are", () => {
    const sqs = simulate(pipeline("sqs", "dynamodb"), writes).spofs.map((s) => s.nodeId);
    expect(sqs).not.toContain("lb"); // ALB is managed
    expect(sqs).not.toContain("db"); // DynamoDB is managed
    const nginx = simulate({ ...pipeline("rabbitmq", "mongodb"), nodes: pipeline("rabbitmq", "mongodb").nodes.map((n) => (n.id === "lb" ? node("lb", "nginx") : n)) }, writes);
    expect(nginx.spofs.map((s) => s.nodeId)).toContain("lb");
  });

  it("SQL-family services keep single-primary writes", () => {
    const t: TrafficProfile = { rps: 2000, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 };
    const r = simulate({ nodes: [node("c", "client"), node("app", "ec2", { replicas: 2 }), node("db", "postgres", { replicas: 5 })], edges: [edge("c", "app"), edge("app", "db")] }, t);
    expect(r.nodes.db.utilization).toBeCloseTo(2000 / 1200);
  });

  it("etcd behaves like ZooKeeper (quorum of 3)", () => {
    const t: TrafficProfile = { rps: 1000, readRatio: 0.5, hotKeyFraction: 0.5, staticFraction: 0, contendedWriteFraction: 1 };
    const g = (replicas: number): SimGraph => ({
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 2 }), node("db", "dynamodb"), node("e", "etcd", { replicas })],
      edges: [edge("c", "app"), edge("app", "db"), edge("app", "e")],
    });
    expect(simulate(g(3), t).unsafeWriteRps).toBe(0);
    expect(simulate(g(2), t).spofs.map((s) => s.nodeId)).toEqual(["e"]);
  });
});

describe("AI, custom components and delivery", () => {
  const chat: TrafficProfile = { rps: 400, readRatio: 1, hotKeyFraction: 0.5, staticFraction: 0, aiFraction: 0.5 };
  const app = (extra: ReturnType<typeof node>[], extraEdges: ReturnType<typeof edge>[]): SimGraph => ({
    nodes: [node("c", "client"), node("app", "appServer"), node("db", "nosqlDb", { replicas: 2 }), ...extra],
    edges: [edge("c", "app"), edge("app", "db"), ...extraEdges],
  });

  it("AI requests make one side call each, add model latency, and never get routed to the model as storage", () => {
    const base = simulate(app([], []), chat);
    const r = simulate(app([node("m", "claude")], [edge("app", "m")]), chat);
    expect(r.aiCallRps).toBeCloseTo(200);
    expect(r.nodes.m.load).toBeCloseTo(200);
    expect(r.nodes.db.load).toBeCloseTo(400);
    expect(r.avgLatencyMs! - base.avgLatencyMs!).toBeCloseTo(0.5 * 800, 0);
  });

  it("calls over the model's rate limit fail", () => {
    const r = simulate(app([node("m", "openai", { capacity: 150 })], [edge("app", "m")]), chat);
    expect(r.errorRps).toBeCloseTo(50);
  });

  it("a fast model (Groq) beats a slow one on latency", () => {
    const groq = simulate(app([node("m", "groq")], [edge("app", "m")]), chat).avgLatencyMs!;
    const gpt = simulate(app([node("m", "openai")], [edge("app", "m")]), chat).avgLatencyMs!;
    expect(groq).toBeLessThan(gpt - 300);
  });

  it("custom components simulate as the behavior they picked", () => {
    const custom = node("x", "custom", { ...CATALOG.nosqlDb.defaults, behavior: "nosqlDb", replicas: 2 });
    const r = simulate({ nodes: [node("c", "client"), node("app", "appServer", { replicas: 4 }), custom], edges: [edge("c", "app"), edge("app", "x")] }, readHeavy);
    expect(r.nodes.x.kind).toBe("custom");
    expect(r.dbLoadRps).toBeCloseTo(5000);
  });

  it("delivery components carry no traffic and raise no design issues", () => {
    const g = app(
      [node("gh", "github"), node("ci", "githubActions"), node("reg", "ecr")],
      [edge("gh", "ci"), edge("ci", "reg"), edge("reg", "app")],
    );
    const r = simulate(g, chat);
    expect(r.issues).toEqual([]);
    expect(r.nodes.app.load).toBeCloseTo(400);
  });
});

describe("delivery pipeline analysis", () => {
  const spec = (n: { kind: NodeKind; config: NodeConfig }) => nodeSpec(n).behavior;
  it("traces repo → CI → registry → servers and flags hand-deployed servers", () => {
    const g: SimGraph = {
      nodes: [node("gh", "github"), node("ci", "dockerBuild"), node("reg", "dockerHub"), node("app", "docker"), node("w", "worker")],
      edges: [edge("gh", "ci"), edge("ci", "reg"), edge("reg", "app")],
    };
    const p = analyzePipeline(g, spec);
    expect(p.chains).toEqual(["GitHub → Docker Build → Docker Hub → Docker Container"]);
    expect(p.problems.join(" ")).toMatch(/Deployed by hand: Background Worker/);
  });

  it("catches a repo nobody builds", () => {
    const p = analyzePipeline({ nodes: [node("gh", "github"), node("app", "appServer")], edges: [] }, spec);
    expect(p.problems[0]).toMatch(/never built/);
  });

  it("fine-tuning flows through a model registry to the model server", () => {
    const g: SimGraph = {
      nodes: [node("ft", "fineTune"), node("hub", "huggingfaceHub"), node("m", "vllm")],
      edges: [edge("ft", "hub"), edge("hub", "m")],
    };
    const p = analyzePipeline(g, spec);
    expect(p.chains).toEqual(["Fine-tuning Job → Hugging Face Hub → vLLM on GPUs"]);
    expect(p.problems).toEqual([]);
  });

  it("is absent when there are no delivery components", () => {
    expect(analyzePipeline({ nodes: [node("app", "appServer")], edges: [] }, spec).present).toBe(false);
  });
});

describe("idle explanations", () => {
  const reads: TrafficProfile = { rps: 800, readRatio: 1, hotKeyFraction: 0.5, staticFraction: 0 };
  const reasons = (g: SimGraph, t: TrafficProfile) => simulate(g, t).idle.map((x) => `${x.nodeId}: ${x.reason}`).join("\n");

  it("a queue with no writes in the traffic says so", () => {
    const g: SimGraph = { nodes: [node("c", "client"), node("app", "appServer"), node("q", "redisStreams")], edges: [edge("c", "app"), edge("app", "q")] };
    expect(reasons(g, reads)).toMatch(/q: .*read share is 100%/);
  });

  it("a link out of a database is flagged and carries nothing", () => {
    const g: SimGraph = {
      nodes: [node("c", "client"), node("app", "appServer"), node("db", "postgres"), node("w", "appServer")],
      edges: [edge("c", "app"), edge("app", "db"), edge("db", "w")],
    };
    const r = simulate(g, reads);
    expect(r.issues.map((i) => i.message).join(" ")).toMatch(/SQL database can't send traffic to an app server/);
    expect(r.nodes.w.load).toBe(0);
  });

  it("a model with AI share at 0% asks for it", () => {
    const g: SimGraph = { nodes: [node("c", "client"), node("app", "appServer"), node("m", "claude")], edges: [edge("c", "app"), edge("app", "m")] };
    expect(reasons(g, reads)).toMatch(/m: No requests call a model/);
    expect(simulate(g, { ...reads, aiFraction: 0.2 }).idle).toEqual([]);
  });
});

describe("contended writes through a queue", () => {
  it("are counted once, at the server that handled the request, not again at the queue consumer", () => {
    const t: TrafficProfile = { rps: 1000, readRatio: 0.5, hotKeyFraction: 0.5, staticFraction: 0, contendedWriteFraction: 0.2 };
    const g = (lockOnApi: boolean): SimGraph => ({
      nodes: [node("c", "client"), node("api", "appServer"), node("q", "redisStreams"), node("dk", "docker"), node("db", "postgres", { replicas: 2 }), ...(lockOnApi ? [node("l", "redisLock", { replicas: 2 })] : [])],
      edges: [edge("c", "api"), edge("api", "q"), edge("q", "dk"), edge("dk", "db"), edge("api", "db"), ...(lockOnApi ? [edge("api", "l")] : [])],
    });
    const without = simulate(g(false), t);
    expect(without.unsafeWriteRps).toBeCloseTo(100); // 500 writes × 20%, once
    expect(without.bottlenecks.filter((b) => /no lock/.test(b.reason)).map((b) => b.nodeId)).toEqual(["api"]);
    expect(simulate(g(true), t).unsafeWriteRps).toBe(0); // locking at the API is enough
  });
});
