import type { Challenge } from "@/lib/challenges/types";
import overloadedDatabase from "./overloaded-database.json";
import singlePointOfFailure from "./single-point-of-failure.json";
import urlShortener from "./url-shortener.json";

/**
 * Challenges are plain JSON so new ones can be added without code changes:
 * drop a file in this folder and add it to the list below. Shape is validated in challenges.test.ts.
 */
export const CHALLENGES: Challenge[] = ([overloadedDatabase, singlePointOfFailure, urlShortener] as unknown as Challenge[]).sort(
  (a, b) => a.order - b.order,
);

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
