import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { relatedLessons } from "./articles";

describe("challenge articles", () => {
  it("every challenge and build problem links to at least two Learn lessons", () => {
    for (const p of [...CHALLENGES, ...DESIGNS]) expect(relatedLessons(p.id).length, p.id).toBeGreaterThanOrEqual(2);
  });
});

describe("lesson → problems", () => {
  it("every lesson links its practice problem first", async () => {
    const { LESSONS } = await import("@/data/lessons");
    const { relatedProblems } = await import("./articles");
    for (const l of LESSONS) {
      const r = relatedProblems(l.id);
      expect(r.length, l.id).toBeGreaterThanOrEqual(1);
      expect(r[0].id, l.id).toBe(l.practice);
    }
  });
});
