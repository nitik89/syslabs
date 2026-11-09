import type { SupabaseClient } from "@supabase/supabase-js";
import { StorageError, type StorageDriver } from "./driver";
import type { ChallengeRecord, InterviewResult, ProgressState, SavedDesign } from "./repo";
import { mergeCards, type CardState } from "./cards";

/** Key-value storage in the `user_data` table, one row per key, visible only to its owner (row-level security). */
export function createSupabaseDriver(sb: SupabaseClient, userId: string): StorageDriver {
  const fail = (what: string, cause: unknown) => new StorageError(`Couldn't ${what} your data in the cloud. Check your connection and try again.`, { cause });
  return {
    async get<T>(key: string): Promise<T | null> {
      const { data, error } = await sb.from("user_data").select("value").eq("user_id", userId).eq("key", key).maybeSingle();
      if (error) throw fail("read", error);
      return (data?.value as T | undefined) ?? null;
    },
    async set<T>(key: string, value: T): Promise<void> {
      const { error } = await sb.from("user_data").upsert({ user_id: userId, key, value, updated_at: new Date().toISOString() });
      if (error) throw fail("save", error);
    },
    async remove(key: string): Promise<void> {
      const { error } = await sb.from("user_data").delete().eq("user_id", userId).eq("key", key);
      if (error) throw fail("delete", error);
    },
  };
}

/* ------------------------- merging guest data into an account ------------------------- */

function betterRecord(a: ChallengeRecord, b: ChallengeRecord): ChallengeRecord {
  const firstPassed = [a.firstPassedAt, b.firstPassedAt].filter((x): x is string => Boolean(x)).sort()[0];
  const history = [...(a.history ?? []), ...(b.history ?? [])]
    .filter((h, i, all) => all.findIndex((x) => x.at === h.at) === i)
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 20);
  return {
    challengeId: a.challengeId,
    bestScore: Math.max(a.bestScore, b.bestScore),
    passed: a.passed || b.passed,
    attempts: a.attempts + b.attempts,
    lastAttemptAt: a.lastAttemptAt > b.lastAttemptAt ? a.lastAttemptAt : b.lastAttemptAt,
    xpAwarded: Math.max(a.xpAwarded, b.xpAwarded),
    ...(firstPassed ? { firstPassedAt: firstPassed } : {}),
    ...(history.length ? { history } : {}),
  };
}

/** Combine two progress states: best result per problem, every active day, XP recomputed from what was awarded. */
export function mergeProgress(a: ProgressState | null, b: ProgressState | null): ProgressState {
  const challenges: Record<string, ChallengeRecord> = { ...(a?.challenges ?? {}) };
  for (const [id, rec] of Object.entries(b?.challenges ?? {})) challenges[id] = challenges[id] ? betterRecord(challenges[id], rec) : rec;
  const xp = Object.values(challenges).reduce((sum, r) => sum + r.xpAwarded, 0);
  const activeDays = [...new Set([...(a?.activeDays ?? []), ...(b?.activeDays ?? [])])].sort();
  return { challenges, xp: Math.max(xp, a?.xp ?? 0, b?.xp ?? 0), activeDays };
}

/** Union of saved designs by id; when both have one, the most recently updated wins. Newest first. */
export function mergeDesigns(a: SavedDesign[] | null, b: SavedDesign[] | null): SavedDesign[] {
  const byId = new Map<string, SavedDesign>();
  for (const d of [...(a ?? []), ...(b ?? [])]) {
    const cur = byId.get(d.id);
    if (!cur || d.updatedAt > cur.updatedAt) byId.set(d.id, d);
  }
  return [...byId.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

/** Copy a guest's progress and designs into their account, merging with anything already there. */
export async function migrateGuestData(local: StorageDriver, cloud: StorageDriver): Promise<void> {
  const [lp, cp, ld, cd] = await Promise.all([
    local.get<ProgressState>("progress"),
    cloud.get<ProgressState>("progress"),
    local.get<SavedDesign[]>("designs"),
    cloud.get<SavedDesign[]>("designs"),
  ]);
  if (lp) await cloud.set("progress", mergeProgress(cp, lp));
  if (ld?.length) await cloud.set("designs", mergeDesigns(cd, ld));
  const [lc, cc] = await Promise.all([local.get<CardState>("cards"), cloud.get<CardState>("cards")]);
  if (lc && Object.keys(lc).length) await cloud.set("cards", mergeCards(cc, lc));
  const [li, ci] = await Promise.all([local.get<InterviewResult[]>("interviews"), cloud.get<InterviewResult[]>("interviews")]);
  if (li?.length) {
    const byId = new Map([...(ci ?? []), ...li].map((r) => [r.id, r]));
    await cloud.set("interviews", [...byId.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50));
  }
}
