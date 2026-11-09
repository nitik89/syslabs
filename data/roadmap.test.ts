import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { DESIGNS } from "./designs";
import { ROADMAP } from "./roadmap";

describe("roadmap", () => {
  it("covers every problem exactly once", () => {
    const ids = ROADMAP.flatMap((s) => s.problems);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...CHALLENGES, ...DESIGNS].map((c) => c.id).sort());
  });
});

describe("lessons", () => {
  it("belong to real stages and practise real problems", async () => {
    const { LESSONS } = await import("./lessons");
    const ids = new Set([...CHALLENGES, ...DESIGNS].map((c) => c.id));
    for (const l of LESSONS) {
      expect(ROADMAP.some((s) => s.id === l.stage), l.id).toBe(true);
      expect(ids.has(l.practice), l.id).toBe(true);
    }
  });
});
