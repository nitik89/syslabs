import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { SOLUTIONS } from "@/data/challenges/solutions";
import { connectionRule, nodeSpec, simulate, type SimGraph } from "@/lib/sim";

function badEdges(g: SimGraph | undefined): string[] {
  if (!g) return [];
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return g.edges.flatMap((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) return [];
    const why = connectionRule(nodeSpec(s).behavior, nodeSpec(t).behavior);
    return why ? [`${e.source} -> ${e.target}: ${why}`] : [];
  });
}

describe("connection rules", () => {
  it("a queue can't write to a database by itself; it needs a worker", () => {
    expect(connectionRule("queue", "sqlDb")).toMatch(/Worker/);
    expect(connectionRule("queue", "worker")).toBeNull();
    expect(connectionRule("client", "sqlDb")).toMatch(/app server/);
    expect(connectionRule("loadBalancer", "nosqlDb")).not.toBeNull();
    expect(connectionRule("sqlDb", "appServer")).not.toBeNull();
    expect(connectionRule("cache", "appServer")).not.toBeNull();
    expect(connectionRule("appServer", "worker")).toMatch(/queue/i);
    expect(connectionRule("appServer", "cache")).toBeNull();
    expect(connectionRule("cache", "sqlDb")).toBeNull();
  });

  it("the simulator ignores a queue wired straight to a database (writes pile up as backlog)", () => {
    const g: SimGraph = {
      nodes: [
        { id: "c", kind: "client", config: { capacity: 0, latencyMs: 0, replicas: 1, costPerReplica: 0 } },
        { id: "app", kind: "appServer", config: { capacity: 5000, latencyMs: 10, replicas: 1, costPerReplica: 70 } },
        { id: "q", kind: "queue", config: { capacity: 50000, latencyMs: 5, replicas: 1, costPerReplica: 40 } },
        { id: "db", kind: "sqlDb", config: { capacity: 1000, latencyMs: 8, replicas: 1, costPerReplica: 180 } },
      ],
      edges: [
        { id: "1", source: "c", target: "app" },
        { id: "2", source: "app", target: "q" },
        { id: "3", source: "q", target: "db" },
      ],
    };
    const r = simulate(g, { rps: 100, readRatio: 0, hotKeyFraction: 0, staticFraction: 0 });
    expect(r.nodes.db.load).toBe(0);
    expect(r.backlogRps).toBeGreaterThan(0);
    expect(r.issues.some((i) => i.edgeId === "3")).toBe(true);
  });

  it.each([...CHALLENGES, ...DESIGNS].map((c) => [c.id, c] as const))("%s: every connection in the starting design and reference makes sense", (id, c) => {
    expect(badEdges(c.startingDesign.graph)).toEqual([]);
    expect(badEdges(c.reference?.graph)).toEqual([]);
    expect(badEdges(SOLUTIONS[id])).toEqual([]);
  });
});
