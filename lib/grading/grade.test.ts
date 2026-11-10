import { describe, expect, it } from "vitest";
import { getDesign } from "@/data/designs";
import { grade, parseGraph, MAX_NODES } from "./grade";
import type { SimGraph } from "@/lib/sim";

const problem = getDesign("pastebin")!;
const reference = problem.reference!.graph;

/** The reference with one harmless change (an extra replica), so it's no longer "the revealed solution". */
function ownDesign(): SimGraph {
  const g = structuredClone(reference);
  const app = g.nodes.find((n) => n.kind !== "client")!;
  app.config.replicas += 1;
  return g;
}

describe("server grading", () => {
  it("grades an honest passing design and awards XP like the client", () => {
    const r = grade("pastebin", ownDesign());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.passed).toBe(true);
    expect(r.reference).toBe(false);
    expect(r.xp).toBe(r.score + 50);
    expect(r.hiddenPassed).toBe(r.hiddenTotal);
  });

  it("the unchanged reference is graded but worth no XP", () => {
    const r = grade("pastebin", reference);
    expect(r.ok && r.reference && r.xp === 0).toBe(true);
  });

  it("edited capacity, latency and cost don't change the result", () => {
    const cheat = ownDesign();
    for (const n of cheat.nodes) n.config = { ...n.config, capacity: 10_000_000, latencyMs: 0, costPerReplica: 0 };
    const honest = grade("pastebin", ownDesign());
    const cheated = grade("pastebin", cheat);
    expect(cheated).toEqual(honest);
  });

  it("rejects unknown problems and malformed or oversized graphs", () => {
    expect(grade("nope", reference)).toMatchObject({ ok: false, status: 404 });
    expect(grade(42, reference)).toMatchObject({ ok: false, status: 400 });
    expect(parseGraph({ nodes: [], edges: [] })).toBe("graph has no components");
    expect(parseGraph({ nodes: [{ id: "a", kind: "rocket", config: {} }], edges: [] })).toBe("invalid component");
    const big = { nodes: Array.from({ length: MAX_NODES + 1 }, (_, i) => ({ ...reference.nodes[0], id: `n${i}` })), edges: [] };
    expect(parseGraph(big)).toBe("graph is too large");
    const dangling = { nodes: reference.nodes, edges: [{ id: "x", source: reference.nodes[0].id, target: "ghost" }] };
    expect(parseGraph(dangling)).toBe("connection to an unknown component");
  });
});
