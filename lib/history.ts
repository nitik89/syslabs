/**
 * Minimal undo/redo history of immutable snapshots.
 * Call `checkpoint(current)` BEFORE applying a change. Rapid repeated changes with the same `key`
 * (e.g. typing into one field, or a node removal that also removes its edges) coalesce into one step.
 */
export interface History<T> {
  past: T[];
  future: T[];
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 800;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [], lastKey: null, lastAt: -Infinity };
}

export function checkpoint<T>(h: History<T>, current: T, key: string | null, now: number): History<T> {
  if (key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS) {
    return { ...h, lastAt: now, future: [] };
  }
  const past = [...h.past, current];
  if (past.length > HISTORY_LIMIT) past.shift();
  return { past, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (h.past.length === 0) return null;
  const state = h.past[h.past.length - 1];
  return { state, history: { past: h.past.slice(0, -1), future: [current, ...h.future], lastKey: null, lastAt: -Infinity } };
}

export function redo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (h.future.length === 0) return null;
  const [state, ...rest] = h.future;
  return { state, history: { past: [...h.past, current], future: rest, lastKey: null, lastAt: -Infinity } };
}
