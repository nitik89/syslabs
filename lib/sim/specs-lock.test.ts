import { describe, expect, it } from "vitest";
import { DESIGNS } from "@/data/designs";
import { INTERVIEWS } from "@/data/interviews";
import { getDesign } from "@/data/designs";
import { runHiddenTests } from "@/lib/challenges/hidden";
import { scoreDesignAndTwist } from "@/lib/interview/score";
import { CATALOG, lockGraph, nodeMonthlyCost, replicaCost, simulate, type SimGraph } from "@/lib/sim";

/** A one-server design with cheat numbers: huge capacity, no latency, free. */
function cheat(g: SimGraph): SimGraph {
  return {
    ...g,
    nodes: g.nodes.map((n) => (n.kind === "client" ? n : { ...n, config: { ...n.config, capacity: 10_000_000, latencyMs: 0, costPerReplica: 0 } })),
  };
}

describe("graded problems use catalog numbers", () => {
  it("lockGraph restores capacity, latency and cost but keeps replicas and cache size", () => {
    const g: SimGraph = {
      nodes: [{ id: "c", kind: "cache", config: { capacity: 1, latencyMs: 0, replicas: 3, costPerReplica: 0, cacheSizeGb: 32 } }],
      edges: [],
    };
    const [n] = lockGraph(g).nodes;
    const d = CATALOG.cache.defaults;
    expect(n.config).toMatchObject({ capacity: d.capacity, latencyMs: d.latencyMs, costPerReplica: d.costPerReplica, replicas: 3, cacheSizeGb: 32 });
  });

  it("custom components take the numbers of the block they behave like", () => {
    const g: SimGraph = { nodes: [{ id: "x", kind: "custom", config: { capacity: 9e9, latencyMs: 0, replicas: 1, costPerReplica: 0, behavior: "sqlDb" } }], edges: [] };
    expect(lockGraph(g).nodes[0].config).toMatchObject({ capacity: CATALOG.sqlDb.defaults.capacity, costPerReplica: CATALOG.sqlDb.defaults.costPerReplica });
  });

  it("bigger caches cost more", () => {
    const at = (gb: number) => replicaCost({ kind: "cache", config: { ...CATALOG.cache.defaults, cacheSizeGb: gb } });
    expect(at(8)).toBe(CATALOG.cache.defaults.costPerReplica);
    expect(at(32)).toBe(2 * at(8));
    expect(at(1024)).toBeGreaterThan(at(32) * 5);
    expect(nodeMonthlyCost({ kind: "cache", config: { ...CATALOG.cache.defaults, cacheSizeGb: 32, replicas: 2 } })).toBe(4 * at(8));
    expect(simulate({ nodes: [{ id: "c", kind: "cache", config: { ...CATALOG.cache.defaults, cacheSizeGb: 32 } }], edges: [] }, { rps: 0, readRatio: 1, hotKeyFraction: 0.5, staticFraction: 0 }).monthlyCost).toBe(at(32));
  });

  it("hidden tests and interview scoring ignore edited capacity, latency and cost", () => {
    const p = DESIGNS.find((d) => d.id === "pastebin")!;
    const start = p.startingDesign.graph;
    // The starting design (just users plus an app server) can't survive the hidden tests, with or without cheat numbers.
    const starter: SimGraph = {
      nodes: [...start.nodes, { id: "app", kind: "appServer", config: { ...CATALOG.appServer.defaults } }],
      edges: [...start.edges, { id: "e", source: start.nodes[0].id, target: "app" }],
    };
    // Without the lock the cheat numbers would make a difference.
    expect(simulate(cheat(starter), p.traffic).errorRate).toBeLessThan(simulate(starter, p.traffic).errorRate);
    expect(runHiddenTests(cheat(starter), p.traffic).map((h) => h.passed)).toEqual(runHiddenTests(starter, p.traffic).map((h) => h.passed));
    const iv = INTERVIEWS.find((i) => getDesign(i.problem))!;
    const prob = getDesign(iv.problem)!;
    const honest = scoreDesignAndTwist(prob, iv.twist, starter);
    const cheated = scoreDesignAndTwist(prob, iv.twist, cheat(starter));
    expect(cheated.design.score).toBe(honest.design.score);
    expect(cheated.twist.score).toBe(honest.twist.score);
  });
});
