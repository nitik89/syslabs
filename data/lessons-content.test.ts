import { describe, expect, it } from "vitest";
import { LESSONS } from "./lessons";
import { LESSON_DIAGRAMS } from "./lesson-diagrams";
import { LESSON_DEEP } from "./lesson-deep";

describe("lesson diagrams and deep dives", () => {
  it("every lesson has a diagram and in-depth content, and nothing is orphaned", () => {
    const ids = LESSONS.map((l) => l.id).sort();
    expect(Object.keys(LESSON_DIAGRAMS).sort()).toEqual(ids);
    expect(Object.keys(LESSON_DEEP).sort()).toEqual(ids);
  });

  it("diagram links only connect nodes that exist, and node ids are unique", () => {
    for (const [id, d] of Object.entries(LESSON_DIAGRAMS)) {
      const nodeIds = d.nodes.map((n) => n.id);
      expect(new Set(nodeIds).size, id).toBe(nodeIds.length);
      for (const e of d.edges) {
        expect(nodeIds, `${id}: ${e.from}`).toContain(e.from);
        expect(nodeIds, `${id}: ${e.to}`).toContain(e.to);
      }
      for (const n of d.nodes) {
        expect(n.x, `${id}.${n.id} x`).toBeGreaterThanOrEqual(0);
        expect(n.x, `${id}.${n.id} x`).toBeLessThanOrEqual(d.w);
        expect(n.y, `${id}.${n.id} y`).toBeLessThanOrEqual(d.h);
      }
      expect(d.caption.length, id).toBeGreaterThan(40);
    }
  });

  it("deep dives are substantial", () => {
    for (const [id, d] of Object.entries(LESSON_DEEP)) {
      expect(d.sections.length, id).toBeGreaterThanOrEqual(1);
      expect(d.example.steps.length, id).toBeGreaterThanOrEqual(3);
      expect(d.tradeoffs.length, id).toBeGreaterThanOrEqual(2);
      expect(d.mistakes.length, id).toBeGreaterThanOrEqual(3);
      expect(d.interview.length, id).toBeGreaterThanOrEqual(3);
    }
  });
});
