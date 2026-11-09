import { describe, expect, it } from "vitest";
import { addDays, dueCards, mergeCards, scheduleCard } from "./cards";
import { FLASHCARDS } from "@/data/flashcards";
import { LESSONS } from "@/data/lessons";

const T = "2026-11-09";

describe("flashcard scheduling", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays(T, 0)).toBe(T);
  });

  it("pushes cards further out the better you know them", () => {
    const good1 = scheduleCard(undefined, "good", T);
    expect(good1).toMatchObject({ box: 1, due: "2026-11-10", reviews: 1 });
    const good2 = scheduleCard(good1, "good", good1.due);
    expect(good2.box).toBe(2);
    expect(good2.due).toBe(addDays(good1.due, 3));
    expect(scheduleCard(undefined, "easy", T).box).toBe(2);
  });

  it("brings a forgotten card back today and counts the lapse", () => {
    const known = { box: 3, due: T, reviews: 4, lapses: 0 };
    expect(scheduleCard(known, "again", T)).toMatchObject({ box: 0, due: T, lapses: 1, reviews: 5 });
  });

  it("serves due cards first and caps new ones per day", () => {
    const ids = ["a", "b", "c", "d"];
    const state = { a: { box: 1, due: "2026-11-08", reviews: 1, lapses: 0 }, b: { box: 2, due: "2026-11-20", reviews: 2, lapses: 0 } };
    expect(dueCards(ids, state, T, 1)).toEqual({ due: ["a"], fresh: ["c"] });
    // A card first seen today uses up the daily new-card allowance.
    const started = { ...state, c: { box: 1, due: "2026-11-10", reviews: 1, lapses: 0, introduced: T } };
    expect(dueCards(ids, started, T, 1).fresh).toEqual([]);
  });

  it("merges guest and account cards keeping the more-reviewed record", () => {
    const m = mergeCards({ a: { box: 1, due: T, reviews: 1, lapses: 0 } }, { a: { box: 3, due: T, reviews: 5, lapses: 1 }, b: { box: 1, due: T, reviews: 1, lapses: 0 } });
    expect(m.a.reviews).toBe(5);
    expect(Object.keys(m)).toEqual(["a", "b"]);
  });

  it("every card has a unique id and belongs to a real lesson", () => {
    expect(new Set(FLASHCARDS.map((c) => c.id)).size).toBe(FLASHCARDS.length);
    const lessons = new Set(LESSONS.map((l) => l.id));
    for (const c of FLASHCARDS) expect(lessons.has(c.lesson), c.id).toBe(true);
  });
});
