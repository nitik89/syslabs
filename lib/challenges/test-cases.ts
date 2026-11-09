import type { ObjectiveResult } from "./score";
import type { Challenge, Objective, ObjectiveMetric } from "./types";

/** A named group of objectives, shown like a test case: run against your design, pass or fail. */
export interface TestCase {
  id: "peak" | "failure" | "correctness" | "design" | "budget";
  title: string;
  detail: string;
  objectives: Objective[];
}

export interface TestResult {
  test: TestCase;
  passed: boolean;
  results: ObjectiveResult[];
}

const GROUP: Record<ObjectiveMetric, TestCase["id"]> = {
  errorRate: "peak",
  avgLatencyMs: "peak",
  servedRps: "peak",
  cacheHitRatio: "peak",
  dbLoadRps: "peak",
  maxUtilization: "peak",
  backlogRps: "peak",
  spofCount: "failure",
  unsafeWriteRps: "correctness",
  componentLoad: "design",
  monthlyCost: "budget",
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
export const perHour = (monthly: number) => monthly / 730;

export function testCasesFor(ch: Challenge): TestCase[] {
  const t = ch.traffic;
  const meta: Record<TestCase["id"], { title: string; detail: string }> = {
    peak: {
      title: "Peak traffic",
      detail: `${t.rps.toLocaleString("en-US")} req/s · ${pct(t.readRatio)} reads${t.staticFraction > 0 ? ` · ${pct(t.staticFraction)} static` : ""}`,
    },
    failure: { title: "Lose any one component", detail: "Each component is failed in turn; traffic must survive" },
    correctness: { title: "Concurrent writes", detail: `${pct(t.contendedWriteFraction ?? 0)} of writes race for the same resource` },
    design: { title: "Requirements check", detail: "The design uses what the requirements ask for" },
    budget: { title: "Budget", detail: "Monthly cost of every replica" },
  };
  const order: TestCase["id"][] = ["peak", "failure", "correctness", "design", "budget"];
  return order
    .map((id) => ({ id, ...meta[id], objectives: ch.objectives.filter((o) => GROUP[o.metric] === id) }))
    .filter((c) => c.objectives.length > 0);
}

export function runTests(cases: TestCase[], results: ObjectiveResult[]): TestResult[] {
  return cases.map((test) => {
    const rs = test.objectives.map((o) => results.find((r) => r.objective.id === o.id)!).filter(Boolean);
    return { test, results: rs, passed: rs.every((r) => r.met) };
  });
}
