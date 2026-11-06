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
};

/* ------------------------------- tests ------------------------------- */

describe("challenge data", () => {
  it("ships the three required challenges with unique ids", () => {
    expect(CHALLENGES.map((c) => c.id)).toEqual(["overloaded-database", "single-point-of-failure", "url-shortener"]);
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
