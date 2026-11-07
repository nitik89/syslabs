import type { Challenge } from "@/lib/challenges/types";
import overloadedDatabase from "./overloaded-database.json";
import singlePointOfFailure from "./single-point-of-failure.json";
import urlShortener from "./url-shortener.json";
import cloudBillShock from "./cloud-bill-shock.json";
import flashSaleCheckout from "./flash-sale-checkout.json";
import imageHeavyHomepage from "./image-heavy-homepage.json";
import liveScoreboard from "./live-scoreboard.json";
import doubleBookedSeats from "./double-booked-seats.json";
import lostQuorum from "./lost-quorum.json";
import writeStorm from "./write-storm.json";
import chokedFrontDoor from "./choked-front-door.json";
import cacheThatDidntHelp from "./cache-that-didnt-help.json";
import inboxNeverDrains from "./inbox-never-drains.json";
import photoSharingLaunch from "./photo-sharing-launch.json";
import concertTicketDrop from "./concert-ticket-drop.json";
import missingIndex from "./missing-index.json";

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
  doubleBookedSeats,
  lostQuorum,
  writeStorm,
  chokedFrontDoor,
  cacheThatDidntHelp,
  inboxNeverDrains,
  photoSharingLaunch,
  concertTicketDrop,
  missingIndex,
] as unknown as Challenge[]).sort(
  (a, b) => a.order - b.order,
);

export function getChallenge(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

/** Where a challenge or build problem lives in the app. */
export function problemPath(c: { id: string; mode?: "fix" | "build" }): string {
  return c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`;
}
