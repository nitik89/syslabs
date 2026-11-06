import type { Challenge } from "@/lib/challenges/types";
import overloadedDatabase from "./overloaded-database.json";
import singlePointOfFailure from "./single-point-of-failure.json";
import urlShortener from "./url-shortener.json";
import cloudBillShock from "./cloud-bill-shock.json";
import flashSaleCheckout from "./flash-sale-checkout.json";
import imageHeavyHomepage from "./image-heavy-homepage.json";
import liveScoreboard from "./live-scoreboard.json";

/**
 * Challenges are plain JSON so new ones can be added without code changes:
 * drop a file in this folder and add it to the list below. Shape is validated in challenges.test.ts.
 */
export const CHALLENGES: Challenge[] = ([
  overloadedDatabase,
  singlePointOfFailure,
  urlShortener,
  cloudBillShock,
  flashSaleCheckout,
  imageHeavyHomepage,
  liveScoreboard,
] as unknown as Challenge[]).sort(
  (a, b) => a.order - b.order,
);

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
