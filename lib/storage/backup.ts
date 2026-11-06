import { NODE_KINDS } from "@/lib/sim";
import { xpFor, type ChallengeRecord, type ProgressState, type SavedDesign } from "./repo";

export const BACKUP_APP = "syslab";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  designs: SavedDesign[];
  progress: ProgressState;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

/* ------------------------------ validation ------------------------------ */

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === "string";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function checkDesign(d: unknown, i: number): SavedDesign {
  const where = `Design #${i + 1}`;
  if (!isObj(d) || !isStr(d.id) || !isStr(d.name) || !isStr(d.createdAt) || !isStr(d.updatedAt)) throw new BackupError(`${where} is missing its id, name or dates.`);
  const g = d.graph;
  if (!isObj(g) || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw new BackupError(`${where} ("${d.name}") has no valid graph.`);
  const ids = new Set<string>();
  for (const n of g.nodes) {
    if (!isObj(n) || !isStr(n.id) || !(NODE_KINDS as readonly unknown[]).includes(n.kind) || !isObj(n.config)) {
      throw new BackupError(`${where} ("${d.name}") contains an unknown or malformed component.`);
    }
    const c = n.config;
    if (!isNum(c.capacity) || !isNum(c.latencyMs) || !isNum(c.replicas) || !isNum(c.costPerReplica)) {
      throw new BackupError(`${where} ("${d.name}") has a component with invalid numbers.`);
    }
    ids.add(n.id);
  }
  for (const e of g.edges) {
    if (!isObj(e) || !isStr(e.id) || !isStr(e.source) || !isStr(e.target) || !ids.has(e.source) || !ids.has(e.target)) {
      throw new BackupError(`${where} ("${d.name}") has a connection to a missing component.`);
    }
  }
  if (!isObj(d.positions)) throw new BackupError(`${where} ("${d.name}") has no node positions.`);
  const t = d.traffic;
  if (!isObj(t) || !isNum(t.rps) || !isNum(t.readRatio) || !isNum(t.hotKeyFraction) || !isNum(t.staticFraction)) {
    throw new BackupError(`${where} ("${d.name}") has an invalid traffic profile.`);
  }
  if (d.challengeId !== undefined && !isStr(d.challengeId)) throw new BackupError(`${where} has an invalid challenge id.`);
  return d as unknown as SavedDesign;
}

function checkProgress(p: unknown): ProgressState {
  if (!isObj(p) || !isObj(p.challenges) || !isNum(p.xp) || !Array.isArray(p.activeDays)) throw new BackupError("Progress data is malformed.");
  for (const [id, r] of Object.entries(p.challenges)) {
    if (!isObj(r) || r.challengeId !== id || !isNum(r.bestScore) || typeof r.passed !== "boolean" || !isNum(r.attempts) || !isStr(r.lastAttemptAt) || !isNum(r.xpAwarded)) {
      throw new BackupError(`Progress for challenge "${id}" is malformed.`);
    }
  }
  if (!p.activeDays.every((d) => isStr(d) && DAY.test(d))) throw new BackupError("Activity days are malformed.");
  return p as unknown as ProgressState;
}

/** Parse and validate a backup file's text. Throws BackupError with a readable message. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't valid JSON.");
  }
  if (!isObj(raw) || raw.app !== BACKUP_APP) throw new BackupError("This isn't a SysLab backup file.");
  if (raw.version !== BACKUP_VERSION) throw new BackupError(`Unsupported backup version: ${String(raw.version)}.`);
  if (!Array.isArray(raw.designs)) throw new BackupError("The backup has no designs list.");
  const designs = raw.designs.map(checkDesign);
  const progress = checkProgress(raw.progress);
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: isStr(raw.exportedAt) ? raw.exportedAt : "", designs, progress };
}

/* -------------------------------- merging ------------------------------- */

/** Designs: union by id, the most recently updated copy wins. */
export function mergeDesigns(a: SavedDesign[], b: SavedDesign[]): SavedDesign[] {
  const byId = new Map<string, SavedDesign>();
  for (const d of [...a, ...b]) {
    const prev = byId.get(d.id);
    if (!prev || d.updatedAt > prev.updatedAt) byId.set(d.id, d);
  }
  return [...byId.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
}

/** Progress: best of both per challenge; XP is recomputed from the merged records so it can't double count. */
export function mergeProgress(a: ProgressState, b: ProgressState): ProgressState {
  const challenges: Record<string, ChallengeRecord> = { ...a.challenges };
  for (const [id, r] of Object.entries(b.challenges)) {
    const p = challenges[id];
    if (!p) {
      challenges[id] = r;
      continue;
    }
    const passed = p.passed || r.passed;
    const firsts = [p.firstPassedAt, r.firstPassedAt].filter((x): x is string => !!x).sort();
    const bestScore = Math.max(p.bestScore, r.bestScore);
    challenges[id] = {
      challengeId: id,
      bestScore,
      passed,
      attempts: Math.max(p.attempts, r.attempts),
      lastAttemptAt: p.lastAttemptAt > r.lastAttemptAt ? p.lastAttemptAt : r.lastAttemptAt,
      xpAwarded: xpFor(bestScore, passed),
      ...(firsts[0] ? { firstPassedAt: firsts[0] } : {}),
    };
  }
  const xp = Object.values(challenges).reduce((s, r) => s + r.xpAwarded, 0);
  const activeDays = [...new Set([...a.activeDays, ...b.activeDays])].sort();
  return { challenges, xp, activeDays };
}
