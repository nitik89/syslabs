import { describe, expect, it } from "vitest";
import { createMemoryDriver } from "./driver";
import { createRepo } from "./repo";
import { BackupError, parseBackup } from "./backup";

const doc = {
  graph: {
    nodes: [{ id: "c", kind: "client" as const, config: { capacity: 0, latencyMs: 20, replicas: 1, costPerReplica: 0 } }],
    edges: [],
  },
  positions: { c: { x: 0, y: 0 } },
  traffic: { rps: 100, readRatio: 0.5, hotKeyFraction: 0.5, staticFraction: 0 },
};

function clock(iso: string) {
  let t = new Date(iso);
  return { now: () => t, set: (s: string) => (t = new Date(s)) };
}

describe("backup", () => {
  it("round-trips through export, JSON and import", async () => {
    const a = createRepo(createMemoryDriver(), clock("2026-01-02T10:00:00").now);
    await a.saveDesign({ name: "Mine", doc });
    await a.recordAttempt("x", 70, true);
    const text = JSON.stringify(await a.exportBackup());

    const b = createRepo(createMemoryDriver());
    await b.importBackup(parseBackup(text), "replace");
    expect((await b.listDesigns()).map((d) => d.name)).toEqual(["Mine"]);
    expect(await b.getProgress()).toEqual(await a.getProgress());
  });

  it("merge keeps the best of both without double-counting XP", async () => {
    const c = clock("2026-01-01T10:00:00");
    const local = createRepo(createMemoryDriver(), c.now);
    await local.recordAttempt("x", 60, false); // 60 XP
    const other = createRepo(createMemoryDriver(), clock("2026-01-03T10:00:00").now);
    await other.recordAttempt("x", 90, true); // 140 XP
    await other.recordAttempt("y", 30, false); // 30 XP
    await other.saveDesign({ name: "Remote", doc });

    await local.saveDesign({ name: "Local", doc });
    const { progress } = await local.importBackup(parseBackup(JSON.stringify(await other.exportBackup())), "merge");
    expect(progress.challenges.x).toMatchObject({ bestScore: 90, passed: true, xpAwarded: 140 });
    expect(progress.xp).toBe(170);
    expect(progress.activeDays).toEqual(["2026-01-01", "2026-01-03"]);
    expect((await local.listDesigns()).map((d) => d.name).sort()).toEqual(["Local", "Remote"]);
  });

  it("rejects files that are not valid SysLab backups with a readable reason", () => {
    const bad = (t: string) => {
      try {
        parseBackup(t);
        return "accepted";
      } catch (e) {
        expect(e).toBeInstanceOf(BackupError);
        return (e as Error).message;
      }
    };
    expect(bad("{nope")).toMatch(/valid JSON/);
    expect(bad(JSON.stringify({ app: "other" }))).toMatch(/isn't a SysLab backup/);
    const base = { app: "syslab", version: 1, designs: [], progress: { challenges: {}, xp: 0, activeDays: [] } };
    expect(bad(JSON.stringify({ ...base, version: 99 }))).toMatch(/Unsupported/);
    const brokenEdge = { ...doc, graph: { ...doc.graph, edges: [{ id: "e", source: "c", target: "ghost" }] } };
    const design = { ...brokenEdge, id: "d", name: "Bad", createdAt: "t", updatedAt: "t" };
    expect(bad(JSON.stringify({ ...base, designs: [design] }))).toMatch(/missing component/);
    expect(bad(JSON.stringify({ ...base, progress: { ...base.progress, activeDays: ["yesterday"] } }))).toMatch(/Activity days/);
    expect(bad(JSON.stringify(base))).toBe("accepted");
  });
});
