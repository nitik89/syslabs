import { describe, expect, it } from "vitest";
import { createMemoryDriver } from "./driver";
import { createRepo, currentStreak, longestStreak } from "./repo";

const doc = {
  graph: { nodes: [], edges: [] },
  positions: {},
  traffic: { rps: 100, readRatio: 0.5, hotKeyFraction: 0.5, staticFraction: 0 },
};

function clock(iso: string) {
  let t = new Date(iso);
  return { now: () => t, set: (s: string) => (t = new Date(s)) };
}

describe("repo", () => {
  it("saves, updates and deletes designs", async () => {
    const c = clock("2026-01-01T10:00:00");
    const repo = createRepo(createMemoryDriver(), c.now);
    const d = await repo.saveDesign({ name: "A", doc });
    c.set("2026-01-01T11:00:00");
    await repo.saveDesign({ id: d.id, name: "A2", doc });
    let list = await repo.listDesigns();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("A2");
    expect(list[0].createdAt).toBe(d.createdAt);
    await repo.deleteDesign(d.id);
    list = await repo.listDesigns();
    expect(list).toEqual([]);
  });

  it("awards XP only for improvements and the first pass", async () => {
    const repo = createRepo(createMemoryDriver(), clock("2026-01-01T10:00:00").now);
    expect((await repo.recordAttempt("x", 40, false)).xpGained).toBe(40);
    expect((await repo.recordAttempt("x", 30, false)).xpGained).toBe(0);
    expect((await repo.recordAttempt("x", 80, true)).xpGained).toBe(90);
    const { progress, xpGained } = await repo.recordAttempt("x", 80, true);
    expect(xpGained).toBe(0);
    expect(progress.xp).toBe(130);
    expect(progress.challenges.x).toMatchObject({ bestScore: 80, passed: true, attempts: 4 });
  });

  it("starts with genuinely empty progress", async () => {
    const repo = createRepo(createMemoryDriver());
    expect(await repo.getProgress()).toEqual({ challenges: {}, xp: 0, activeDays: [] });
  });
});

describe("streaks", () => {
  it("counts consecutive days ending today or yesterday", () => {
    const days = ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-05"];
    expect(currentStreak(days, new Date(2026, 2, 5))).toBe(1);
    expect(currentStreak(days, new Date(2026, 2, 4))).toBe(3);
    expect(currentStreak(days, new Date(2026, 2, 7))).toBe(0);
    expect(longestStreak(days)).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});
