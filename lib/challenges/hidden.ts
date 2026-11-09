import { lockGraph, simulate, type SimGraph, type TrafficProfile } from "@/lib/sim";

/**
 * Hidden tests: extra scenarios run only on Submit, and revealed only if they fail.
 * They check that a design that passes the visible tests isn't tuned to exactly one traffic profile.
 * Thresholds are calibrated so every reference solution passes (see data tests).
 */
export interface HiddenTest {
  id: "spike" | "cold-cache";
  title: string;
  /** Shown once the test fails, so the user knows what to fix. */
  detail: string;
  maxErrorRate: number;
  traffic: (t: TrafficProfile) => TrafficProfile;
}

export const HIDDEN_TESTS: HiddenTest[] = [
  {
    id: "spike",
    title: "Viral spike",
    detail: "Traffic jumps 30% above the stated peak. Error rate must stay at or below 5%: leave headroom instead of sizing to exactly the peak.",
    maxErrorRate: 0.05,
    traffic: (t) => ({ ...t, rps: t.rps * 1.3 }),
  },
  {
    id: "cold-cache",
    title: "Cache restart",
    detail: "Caches come back empty, so far fewer reads hit hot keys. Error rate must stay at or below 20%: the database behind the cache needs enough capacity to survive misses.",
    maxErrorRate: 0.2,
    traffic: (t) => ({ ...t, hotKeyFraction: t.hotKeyFraction * 0.6 }),
  },
];

export interface HiddenResult {
  test: HiddenTest;
  passed: boolean;
  errorRate: number;
}

export function runHiddenTests(graph: SimGraph, traffic: TrafficProfile): HiddenResult[] {
  const locked = lockGraph(graph);
  return HIDDEN_TESTS.map((test) => {
    const r = simulate(locked, test.traffic(traffic));
    const errorRate = r.offeredRps > 0 ? r.errorRps / r.offeredRps : 1;
    return { test, errorRate, passed: r.offeredRps > 0 && errorRate <= test.maxErrorRate + 1e-9 };
  });
}
