import type { SimGraph, TrafficProfile } from "@/lib/sim";
import type { StorageDriver } from "./driver";
import { BACKUP_APP, BACKUP_VERSION, mergeDesigns, mergeProgress, type BackupFile } from "./backup";

/* ------------------------------- Models ------------------------------- */

export interface Position {
  x: number;
  y: number;
}

/** A design as the editor persists it: sim graph plus node positions. */
export interface DesignDoc {
  graph: SimGraph;
  positions: Record<string, Position>;
  traffic: TrafficProfile;
}

export interface SavedDesign extends DesignDoc {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Set when the design was saved from a challenge. */
  challengeId?: string;
}

export interface ChallengeRecord {
  challengeId: string;
  bestScore: number;
  passed: boolean;
  attempts: number;
  firstPassedAt?: string;
  lastAttemptAt: string;
  /** XP already awarded for this challenge (so re-runs only award improvements). */
  xpAwarded: number;
}

export interface ProgressState {
  challenges: Record<string, ChallengeRecord>;
  xp: number;
  /** Local calendar days (YYYY-MM-DD) with at least one simulation run or attempt. */
  activeDays: string[];
}

export const EMPTY_PROGRESS: ProgressState = { challenges: {}, xp: 0, activeDays: [] };

const KEYS = {
  designs: "designs",
  progress: "progress",
  draft: (scope: string) => `draft:${scope}`,
};

/* ----------------------------- Repository ----------------------------- */

export function createRepo(driver: StorageDriver, now: () => Date = () => new Date()) {
  const listDesigns = async (): Promise<SavedDesign[]> => {
    const list = (await driver.get<SavedDesign[]>(KEYS.designs)) ?? [];
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };

  return {
    listDesigns,

    async saveDesign(input: { id?: string; name: string; doc: DesignDoc; challengeId?: string }): Promise<SavedDesign> {
      const list = await listDesigns();
      const ts = now().toISOString();
      const existing = input.id ? list.find((d) => d.id === input.id) : undefined;
      const design: SavedDesign = {
        ...input.doc,
        id: existing?.id ?? newId(ts, list.length),
        name: input.name.trim() || "Untitled design",
        createdAt: existing?.createdAt ?? ts,
        updatedAt: ts,
        ...(input.challengeId ? { challengeId: input.challengeId } : {}),
      };
      const next = existing ? list.map((d) => (d.id === design.id ? design : d)) : [design, ...list];
      await driver.set(KEYS.designs, next);
      return design;
    },

    async deleteDesign(id: string): Promise<void> {
      const list = await listDesigns();
      await driver.set(
        KEYS.designs,
        list.filter((d) => d.id !== id),
      );
    },

    async getDraft(scope: string): Promise<DesignDoc | null> {
      return driver.get<DesignDoc>(KEYS.draft(scope));
    },
    async setDraft(scope: string, doc: DesignDoc): Promise<void> {
      await driver.set(KEYS.draft(scope), doc);
    },
    async clearDraft(scope: string): Promise<void> {
      await driver.remove(KEYS.draft(scope));
    },

    async getProgress(): Promise<ProgressState> {
      const p = await driver.get<ProgressState>(KEYS.progress);
      if (!p || typeof p !== "object") return { ...EMPTY_PROGRESS, challenges: {}, activeDays: [] };
      return { challenges: p.challenges ?? {}, xp: p.xp ?? 0, activeDays: p.activeDays ?? [] };
    },

    /** Record that the user did something today (feeds the streak). */
    async markActive(): Promise<ProgressState> {
      const p = await this.getProgress();
      const day = localDay(now());
      if (!p.activeDays.includes(day)) {
        p.activeDays = [...p.activeDays, day].sort();
        await driver.set(KEYS.progress, p);
      }
      return p;
    },

    /** Record a scored challenge attempt. Returns updated progress and XP gained by this attempt. */
    async recordAttempt(challengeId: string, score: number, passed: boolean): Promise<{ progress: ProgressState; xpGained: number }> {
      const p = await this.getProgress();
      const ts = now().toISOString();
      const prev = p.challenges[challengeId];
      const rec: ChallengeRecord = {
        challengeId,
        bestScore: Math.max(prev?.bestScore ?? 0, score),
        passed: (prev?.passed ?? false) || passed,
        attempts: (prev?.attempts ?? 0) + 1,
        lastAttemptAt: ts,
        xpAwarded: prev?.xpAwarded ?? 0,
        ...(prev?.firstPassedAt ? { firstPassedAt: prev.firstPassedAt } : passed ? { firstPassedAt: ts } : {}),
      };
      const entitled = xpFor(rec.bestScore, rec.passed);
      const xpGained = Math.max(0, entitled - rec.xpAwarded);
      rec.xpAwarded += xpGained;
      p.challenges[challengeId] = rec;
      p.xp += xpGained;
      const day = localDay(now());
      if (!p.activeDays.includes(day)) p.activeDays = [...p.activeDays, day].sort();
      await driver.set(KEYS.progress, p);
      return { progress: p, xpGained };
    },

    async resetProgress(): Promise<void> {
      await driver.remove(KEYS.progress);
    },

    /** Everything worth keeping: saved designs and progress (drafts are scratch space and not included). */
    async exportBackup(): Promise<BackupFile> {
      return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now().toISOString(), designs: await listDesigns(), progress: await this.getProgress() };
    },

    /** Apply a validated backup. "merge" keeps the best of both; "replace" overwrites designs and progress. */
    async importBackup(backup: BackupFile, mode: "merge" | "replace"): Promise<{ designs: number; progress: ProgressState }> {
      const designs = mode === "replace" ? backup.designs : mergeDesigns(await listDesigns(), backup.designs);
      const progress = mode === "replace" ? backup.progress : mergeProgress(await this.getProgress(), backup.progress);
      await driver.set(KEYS.designs, designs);
      await driver.set(KEYS.progress, progress);
      return { designs: designs.length, progress };
    },
  };
}

export type Repo = ReturnType<typeof createRepo>;

/* ------------------------------- Rules -------------------------------- */

/** XP: 1 point per score point, plus a 50 XP bonus the first time a challenge is passed. */
export function xpFor(bestScore: number, passed: boolean): number {
  return Math.round(bestScore) + (passed ? 50 : 0);
}

export function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Consecutive active days ending today (or yesterday, so the streak survives until the day ends). */
export function currentStreak(activeDays: string[], today: Date): number {
  const set = new Set(activeDays);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function longestStreak(activeDays: string[]): number {
  const days = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const d of days) {
    const [y, m, dd] = d.split("-").map(Number);
    const cur = new Date(y, m - 1, dd);
    if (prev) {
      const next = new Date(prev);
      next.setDate(next.getDate() + 1);
      run = localDay(next) === d ? run + 1 : 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

function newId(ts: string, n: number): string {
  return `d_${ts.replace(/\D/g, "")}_${n}`;
}

/** Levels: every level needs 250 XP. */
export const XP_PER_LEVEL = 250;
export function levelOf(xp: number): { level: number; into: number; toNext: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  return { level, into, toNext: XP_PER_LEVEL - into };
}

/** Fired on window after progress changes, so the shell can refresh its counts. */
export const PROGRESS_EVENT = "syslab:progress";
