import { describe, expect, it } from "vitest";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { relatedLessons } from "./articles";

describe("challenge articles", () => {
  it("every challenge and build problem links to at least two Learn lessons", () => {
    for (const p of [...CHALLENGES, ...DESIGNS]) expect(relatedLessons(p.id).length, p.id).toBeGreaterThanOrEqual(2);
  });
});
