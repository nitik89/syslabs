/** Spaced repetition for flashcards: Leitner boxes with growing intervals. Pure, so it's easy to test. */
export type Rating = "again" | "hard" | "good" | "easy";

export interface CardRecord {
  /** 0 = learning; higher boxes come back less often. */
  box: number;
  /** Next review day, YYYY-MM-DD (local). */
  due: string;
  reviews: number;
  lapses: number;
  /** Day the card was first reviewed (counts against the daily new-card limit). */
  introduced?: string;
}

export type CardState = Record<string, CardRecord>;

/** Days until the next review for each box. */
export const BOX_DAYS = [0, 1, 3, 7, 16, 35] as const;
const MAX_BOX = BOX_DAYS.length - 1;
/** New cards introduced per day, so a fresh deck isn't overwhelming. */
export const NEW_PER_DAY = 10;

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function scheduleCard(prev: CardRecord | undefined, rating: Rating, today: string): CardRecord {
  const box = prev?.box ?? 0;
  const base = { reviews: (prev?.reviews ?? 0) + 1, lapses: prev?.lapses ?? 0, introduced: prev ? prev.introduced : today };
  switch (rating) {
    case "again":
      return { ...base, box: 0, due: today, lapses: base.lapses + (prev ? 1 : 0) };
    case "hard": {
      const b = Math.max(1, box);
      return { ...base, box: b, due: addDays(today, Math.max(1, Math.round(BOX_DAYS[b] / 2))) };
    }
    case "good": {
      const b = Math.min(MAX_BOX, box + 1);
      return { ...base, box: b, due: addDays(today, BOX_DAYS[b]) };
    }
    case "easy": {
      const b = Math.min(MAX_BOX, box + 2);
      return { ...base, box: b, due: addDays(today, Math.round(BOX_DAYS[b] * 1.3)) };
    }
  }
}

/** Cards to review today: everything due, then up to `newLimit` never-seen cards (in deck order). */
export function dueCards(ids: string[], state: CardState, today: string, newLimit = NEW_PER_DAY): { due: string[]; fresh: string[] } {
  const due = ids.filter((id) => state[id] && state[id].due <= today).sort((a, b) => state[a].due.localeCompare(state[b].due));
  const startedToday = Object.values(state).filter((c) => c.introduced === today).length;
  const fresh = ids.filter((id) => !state[id]).slice(0, Math.max(0, newLimit - startedToday));
  return { due, fresh };
}

/** Merge two card states (guest → account): keep whichever record has seen more reviews. */
export function mergeCards(a: CardState | null, b: CardState | null): CardState {
  const out: CardState = { ...(a ?? {}) };
  for (const [id, r] of Object.entries(b ?? {})) if (!out[id] || r.reviews > out[id].reviews) out[id] = r;
  return out;
}
