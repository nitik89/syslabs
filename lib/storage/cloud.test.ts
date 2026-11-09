import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLocalStorageDriver } from "./driver";
import { createSupabaseDriver, mergeDesigns, mergeProgress, migrateGuestData } from "./cloud";
import type { ProgressState, SavedDesign } from "./repo";

/** A tiny in-memory stand-in for the user_data table, enough for the driver's queries. */
function fakeSupabase() {
  const rows = new Map<string, unknown>();
  const k = (u: unknown, key: unknown) => `${u}|${key}`;
  const query = () => {
    const f: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => ((f[col] = v), q),
      maybeSingle: async () => ({ data: rows.has(k(f.user_id, f.key)) ? { value: rows.get(k(f.user_id, f.key)) } : null, error: null }),
      upsert: async (r: { user_id: string; key: string; value: unknown }) => (rows.set(k(r.user_id, r.key), r.value), { error: null }),
      delete: () => ({
        eq: (c1: string, v1: unknown) => ({ eq: async (c2: string, v2: unknown) => (rows.delete(k(c1 === "user_id" ? v1 : v2, c1 === "key" ? v1 : v2)), { error: null }) }),
      }),
    };
    return q;
  };
  return { sb: { from: () => query() } as unknown as SupabaseClient, rows };
}

class MemStorage {
  m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const rec = (id: string, bestScore: number, passed: boolean, xpAwarded: number, at: string) => ({ challengeId: id, bestScore, passed, attempts: 1, lastAttemptAt: at, xpAwarded });
const design = (id: string, updatedAt: string): SavedDesign => ({ id, name: id, createdAt: updatedAt, updatedAt, graph: { nodes: [], edges: [] }, positions: {}, traffic: { rps: 1, readRatio: 1, hotKeyFraction: 0, staticFraction: 0 } });

describe("cloud storage", () => {
  it("round-trips values per user and key", async () => {
    const { sb } = fakeSupabase();
    const a = createSupabaseDriver(sb, "u1");
    const b = createSupabaseDriver(sb, "u2");
    await a.set("progress", { xp: 5 });
    expect(await a.get("progress")).toEqual({ xp: 5 });
    expect(await b.get("progress")).toBeNull();
    await a.remove("progress");
    expect(await a.get("progress")).toBeNull();
  });

  it("merges progress keeping the best result per problem and every active day", () => {
    const a: ProgressState = { xp: 100, activeDays: ["2026-11-01"], challenges: { x: rec("x", 60, false, 30, "2026-11-01T00:00:00Z") } };
    const b: ProgressState = { xp: 120, activeDays: ["2026-11-02"], challenges: { x: rec("x", 90, true, 120, "2026-11-02T00:00:00Z"), y: rec("y", 80, true, 100, "2026-11-02T00:00:00Z") } };
    const m = mergeProgress(a, b);
    expect(m.challenges.x).toMatchObject({ bestScore: 90, passed: true, attempts: 2, xpAwarded: 120 });
    expect(m.challenges.y.passed).toBe(true);
    expect(m.xp).toBe(220);
    expect(m.activeDays).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("merges designs by id, newest version wins", () => {
    const m = mergeDesigns([design("a", "2026-11-01"), design("b", "2026-11-05")], [design("a", "2026-11-03")]);
    expect(m.map((d) => `${d.id}@${d.updatedAt}`)).toEqual(["b@2026-11-05", "a@2026-11-03"]);
  });

  it("moves a guest's progress into their account without losing what's there", async () => {
    const { sb } = fakeSupabase();
    const cloud = createSupabaseDriver(sb, "u1");
    const local = createLocalStorageDriver(new MemStorage() as unknown as Storage);
    await cloud.set("progress", { xp: 50, activeDays: [], challenges: { x: rec("x", 70, true, 50, "2026-11-01T00:00:00Z") } });
    await local.set("progress", { xp: 30, activeDays: ["2026-11-09"], challenges: { y: rec("y", 65, false, 30, "2026-11-09T00:00:00Z") } });
    await local.set("designs", [design("d1", "2026-11-09")]);
    await migrateGuestData(local, cloud);
    const p = await cloud.get<ProgressState>("progress");
    expect(Object.keys(p!.challenges).sort()).toEqual(["x", "y"]);
    expect(p!.xp).toBe(80);
    expect((await cloud.get<SavedDesign[]>("designs"))!.map((d) => d.id)).toEqual(["d1"]);
  });
});
