import { describe, expect, it } from "vitest";
import { NODE_KINDS, simulate, type SimGraph } from "@/lib/sim";
import { scoreChallenge } from "@/lib/challenges/score";
import { runHiddenTests } from "@/lib/challenges/hidden";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS, DESIGN_CATEGORIES, getDesign } from "./index";

const run = (id: string, graph = getDesign(id)!.reference!.graph) => {
  const d = getDesign(id)!;
  const r = simulate(graph, d.traffic);
  return { r, s: scoreChallenge(d, r, graph) };
};

describe("build problems", () => {
  it("have unique ids (also distinct from challenges, since progress is shared) and categories", () => {
    const ids = DESIGNS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(CHALLENGES.some((c) => c.id === id)).toBe(false);
    expect(DESIGNS.length).toBeGreaterThanOrEqual(12);
    expect(DESIGN_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  for (const d of DESIGNS) {
    describe(d.id, () => {
      it("is a well-formed build problem", () => {
        expect(d.mode).toBe("build");
        expect(d.category).toBeTruthy();
        expect(d.requirements!.functional.length).toBeGreaterThan(0);
        expect(d.requirements!.nonFunctional.length).toBeGreaterThan(0);
        expect(d.estimates!.length).toBeGreaterThan(0);
        expect(d.hints).toHaveLength(3);
        const w = d.scoring.weights;
        expect(w.performance + w.reliability + w.cost + w.architecture).toBeCloseTo(1, 6);
        for (const n of d.reference!.graph.nodes) {
          expect(NODE_KINDS as readonly string[]).toContain(n.kind);
          expect(d.reference!.positions[n.id]).toBeDefined();
        }
        // Every requirement check names at least one behavior.
        for (const o of d.objectives.filter((o) => o.metric === "componentLoad")) expect(o.kinds?.length).toBeGreaterThan(0);
      });

      it("a blank canvas fails", () => {
        expect(run(d.id, d.startingDesign.graph).s.passed).toBe(false);
      });

      it("the reference architecture passes every objective with a high score", () => {
        const { s } = run(d.id);
        const failing = s.objectives.filter((o) => !o.met).map((o) => `${o.objective.id}=${o.actual}`);
        expect(failing).toEqual([]);
        expect(s.total).toBeGreaterThanOrEqual(75);
        const hidden = runHiddenTests(getDesign(d.id)!.reference!.graph, d.traffic).filter((h) => !h.passed).map((h) => h.test.id);
        expect(hidden).toEqual([]);
      });
    });
  }

  it("requirement checks really check: dropping the CDN fails 'uses-cdn' in the shopping app", () => {
    const g = structuredClone(getDesign("shopping-app")!.reference!.graph);
    g.nodes = g.nodes.filter((n) => n.id !== "cdn-1");
    g.edges = g.edges.filter((e) => e.target !== "cdn-1");
    const { s } = run("shopping-app", g);
    expect(s.objectives.find((o) => o.objective.id === "uses-cdn")!.met).toBe(false);
  });

  it("notification system: an Application Gateway counts as the gateway, a plain load balancer doesn't", () => {
    const met = (g: SimGraph) =>
      run("notification-system", g).s.objectives.find((o) => o.objective.id === "uses-gateway")!.met;
    const ref = getDesign("notification-system")!.reference!.graph;
    expect(ref.nodes.some((n) => n.kind === "appGateway")).toBe(true);
    expect(met(ref)).toBe(true);
    const lbOnly = structuredClone(ref);
    lbOnly.nodes = lbOnly.nodes.map((n) => (n.kind === "appGateway" ? { ...n, kind: "loadBalancer" as const } : n));
    expect(met(lbOnly)).toBe(false);
  });
});
