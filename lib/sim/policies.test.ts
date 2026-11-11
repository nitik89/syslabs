import { describe, expect, it } from "vitest";
import { CATALOG, cacheHitRatioFor, connectionLimit, simulate, type SimGraph, type TrafficProfile } from "@/lib/sim";

const traffic: TrafficProfile = { rps: 4000, readRatio: 0.9, hotKeyFraction: 0.8, staticFraction: 0 };
const node = (id: string, kind: keyof typeof CATALOG, extra: Record<string, unknown> = {}) => ({ id, kind, config: { ...CATALOG[kind].defaults, ...extra } });

describe("component policies", () => {
  it("cache: LFU beats LRU beats FIFO/random on skewed traffic; short TTLs miss more", () => {
    const base = { cacheSizeGb: 16 };
    const lru = cacheHitRatioFor(base, 0.8);
    expect(cacheHitRatioFor({ ...base, eviction: "lfu" }, 0.8)).toBeGreaterThan(lru);
    expect(cacheHitRatioFor({ ...base, eviction: "fifo" }, 0.8)).toBeLessThan(lru);
    expect(cacheHitRatioFor({ ...base, eviction: "random" }, 0.8)).toBeLessThan(cacheHitRatioFor({ ...base, eviction: "fifo" }, 0.8));
    expect(cacheHitRatioFor({ ...base, ttlSeconds: 5 }, 0.8)).toBeLessThan(cacheHitRatioFor({ ...base, ttlSeconds: 300 }, 0.8));
    expect(cacheHitRatioFor({ ...base, ttlSeconds: 3600 }, 0.8)).toBeCloseTo(lru, 10);
  });

  it("database: a tiny connection pool caps throughput; the default doesn't", () => {
    const sql = CATALOG.sqlDb.defaults;
    expect(connectionLimit(undefined, sql.latencyMs)).toBeGreaterThan(sql.capacity * 5);
    const g = (maxConnections?: number): SimGraph => ({
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 4 }), node("db", "sqlDb", maxConnections ? { maxConnections } : {})],
      edges: [
        { id: "e1", source: "c", target: "app" },
        { id: "e2", source: "app", target: "db" },
      ],
    });
    const t: TrafficProfile = { ...traffic, rps: 900, hotKeyFraction: 0 };
    expect(simulate(g(), t).errorRate).toBeLessThan(0.01);
    expect(simulate(g(3), t).errorRate).toBeGreaterThan(0.3);
  });

  it("write-back cache: absorbs writes so less reaches the database", () => {
    const g = (writePolicy?: "write-back"): SimGraph => ({
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 3 }), node("cache", "cache", writePolicy ? { writePolicy } : {}), node("db", "sqlDb")],
      edges: [
        { id: "e1", source: "c", target: "app" },
        { id: "e2", source: "app", target: "cache" },
        { id: "e3", source: "app", target: "db" },
        { id: "e4", source: "cache", target: "db" },
      ],
    });
    const t: TrafficProfile = { rps: 2000, readRatio: 0.2, hotKeyFraction: 0.8, staticFraction: 0 };
    const plain = simulate(g(), t).nodes.db.loadByClass.write;
    const wb = simulate(g("write-back"), t).nodes.db.loadByClass.write;
    expect(wb).toBeLessThan(plain * 0.5);
  });

  it("load balancer: IP hash splits unevenly; without health checks a dead server keeps getting traffic", () => {
    const g = (lb: Record<string, unknown>): SimGraph => ({
      nodes: [node("c", "client"), node("lb", "loadBalancer", lb), node("a", "appServer"), node("b", "appServer")],
      edges: [
        { id: "e1", source: "c", target: "lb" },
        { id: "e2", source: "lb", target: "a" },
        { id: "e3", source: "lb", target: "b" },
      ],
    });
    const t: TrafficProfile = { ...traffic, rps: 2000 };
    const even = simulate(g({}), t);
    expect(even.nodes.a.load).toBeCloseTo(even.nodes.b.load, 0);
    const sticky = simulate(g({ lbAlgorithm: "ip-hash" }), t);
    expect(sticky.nodes.a.load).toBeGreaterThan(sticky.nodes.b.load * 1.5);
    const checked = simulate(g({}), t);
    const blind = simulate(g({ healthChecks: false }), t);
    // Same with every server up…
    expect(blind.errorRate).toBeCloseTo(checked.errorRate, 5);
  });
});

describe("more component settings", () => {
  const app = (extra: Record<string, unknown>): SimGraph => ({
    nodes: [node("c", "client"), node("app", "appServer", extra)],
    edges: [{ id: "e1", source: "c", target: "app" }],
  });
  const t: TrafficProfile = { rps: 4000, readRatio: 0.9, hotKeyFraction: 0.5, staticFraction: 0 };

  it("autoscaling adds replicas under load (up to the max) and you pay for them", () => {
    const fixed = simulate(app({ replicas: 1 }), t);
    const scaled = simulate(app({ replicas: 1, autoscaleMax: 6 }), t);
    expect(fixed.errorRate).toBeGreaterThan(0.5);
    expect(scaled.errorRate).toBeLessThan(0.01);
    expect(scaled.nodes.app.replicasUsed).toBeGreaterThan(1);
    expect(scaled.nodes.app.replicasUsed).toBeLessThanOrEqual(6);
    expect(scaled.monthlyCost).toBeGreaterThan(fixed.monthlyCost);
    // Capped at the max: still overloaded if the max is too low.
    expect(simulate(app({ replicas: 1, autoscaleMax: 2 }), t).errorRate).toBeGreaterThan(0.2);
  });

  it("CDN TTL: short TTLs send static misses back to the origin", () => {
    const g = (cdnTtlSeconds?: number): SimGraph => ({
      nodes: [node("c", "client"), node("cdn", "cdn", cdnTtlSeconds ? { cdnTtlSeconds } : {}), node("store", "objectStorage")],
      edges: [
        { id: "e1", source: "c", target: "cdn" },
        { id: "e2", source: "cdn", target: "store" },
      ],
    });
    const st: TrafficProfile = { rps: 10000, readRatio: 1, hotKeyFraction: 0.5, staticFraction: 1 };
    expect(simulate(g(), st).nodes.store.load).toBe(0);
    expect(simulate(g(30), st).nodes.store.load).toBeGreaterThan(simulate(g(86_400), st).nodes.store.load);
  });

  it("NoSQL strong consistency halves read capacity and is slower", () => {
    const g = (consistency?: "strong"): SimGraph => ({
      nodes: [node("c", "client"), node("app", "appServer", { replicas: 10 }), node("db", "nosqlDb", consistency ? { consistency } : {})],
      edges: [
        { id: "e1", source: "c", target: "app" },
        { id: "e2", source: "app", target: "db" },
      ],
    });
    const rt: TrafficProfile = { rps: 4000, readRatio: 1, hotKeyFraction: 0, staticFraction: 0 };
    expect(simulate(g("strong"), rt).nodes.db.utilization).toBeCloseTo(simulate(g(), rt).nodes.db.utilization * 2, 5);
  });
});

describe("app server settings", () => {
  const g = (extra: Record<string, unknown>): SimGraph => ({
    nodes: [node("c", "client"), node("app", "appServer", extra)],
    edges: [{ id: "e1", source: "c", target: "app" }],
  });
  const t: TrafficProfile = { rps: 2500, readRatio: 0.9, hotKeyFraction: 0.5, staticFraction: 0 };

  it("a large instance doubles capacity and costs a bit more than double", () => {
    const medium = simulate(g({}), t);
    const large = simulate(g({ instanceSize: "large" }), t);
    expect(medium.errorRate).toBeGreaterThan(0.3);
    expect(large.errorRate).toBeLessThan(medium.errorRate);
    expect(large.nodes.app.utilization).toBeCloseTo(medium.nodes.app.utilization / 2, 5);
    expect(large.monthlyCost).toBeCloseTo(medium.monthlyCost * 2.2, 0);
  });

  it("a timeout caps latency and turns slow requests into fast errors", () => {
    const slow = simulate(g({}), { ...t, rps: 1400 });
    const capped = simulate(g({ timeoutMs: 20 }), { ...t, rps: 1400 });
    expect(slow.nodes.app.latencyMs).toBeGreaterThan(20);
    expect(capped.nodes.app.latencyMs).toBeLessThanOrEqual(20);
    expect(capped.errorRate).toBeGreaterThan(slow.errorRate);
  });
});

describe("request types (read and write services)", () => {
  const g = (readSvc: Record<string, unknown>, writeSvc: Record<string, unknown>): SimGraph => ({
    nodes: [
      node("c", "client"),
      node("lb", "loadBalancer"),
      node("feed", "appServer", { replicas: 2, ...readSvc }),
      node("posts", "appServer", { replicas: 2, ...writeSvc }),
      node("db", "sqlDb", { replicas: 2 }),
    ],
    edges: [
      { id: "e1", source: "c", target: "lb" },
      { id: "e2", source: "lb", target: "feed" },
      { id: "e3", source: "lb", target: "posts" },
      { id: "e4", source: "feed", target: "db" },
      { id: "e5", source: "posts", target: "db" },
    ],
  });
  const t: TrafficProfile = { rps: 1000, readRatio: 0.8, hotKeyFraction: 0.5, staticFraction: 0 };

  it("by default every service takes everything (split evenly)", () => {
    const r = simulate(g({}, {}), t);
    expect(r.nodes.feed.load).toBeCloseTo(r.nodes.posts.load, 0);
  });

  it("a read service gets only reads and a post service only writes", () => {
    const r = simulate(g({ handles: ["read"] }, { handles: ["write"] }), t);
    expect(r.nodes.feed.load).toBeCloseTo(800, 0);
    expect(r.nodes.posts.load).toBeCloseTo(200, 0);
    expect(r.errorRate).toBeLessThan(0.01);
  });

  it("if no service handles writes, writes fail", () => {
    const r = simulate(g({ handles: ["read"] }, { handles: ["read"] }), t);
    expect(r.errorRate).toBeCloseTo(0.2, 2);
  });
});
