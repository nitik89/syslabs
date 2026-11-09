import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import type { Challenge } from "@/lib/challenges/types";

const ALL: Challenge[] = [...CHALLENGES, ...DESIGNS];

/** Today's problem: the same for everyone on a given day, cycling through the whole bank in a shuffled order. */
export function dailyProblem(date: Date = new Date()): Challenge {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  // A fixed odd multiplier walks every index before repeating (bank size is small and not a multiple of 7919).
  const i = (day * 7919) % ALL.length;
  return ALL[i];
}

export const problemPath = (c: Challenge) => (c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`);
