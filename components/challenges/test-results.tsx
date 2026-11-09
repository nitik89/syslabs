"use client";

import { Check, X } from "lucide-react";
import type { ObjectiveResult } from "@/lib/challenges/score";
import type { TestCase, TestResult } from "@/lib/challenges/test-cases";
import type { Objective } from "@/lib/challenges/types";
import { fmtPct, fmtRps } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatMetric } from "./score-card";
import { fmtLatency } from "@/components/lab/run-console";

const METRIC_NAME: Partial<Record<Objective["metric"], string>> = {
  errorRate: "error rate",
  avgLatencyMs: "avg latency",
  dbLoadRps: "db load",
  spofCount: "single points of failure",
  monthlyCost: "cost",
  servedRps: "served",
  cacheHitRatio: "cache hits",
  maxUtilization: "busiest component",
  backlogRps: "queue backlog",
  unsafeWriteRps: "unsafe writes",
};
const OP = { "<=": "≤", ">=": "≥", "==": "=" } as const;

function fmtValue(o: Objective, v: number): string {
  switch (o.metric) {
    case "errorRate":
      return fmtPct(v, v < 0.01 ? 2 : 1);
    case "cacheHitRatio":
    case "maxUtilization":
      return fmtPct(v, 0);
    case "avgLatencyMs":
      return fmtLatency(v);
    case "monthlyCost":
      return `$${(v / 730).toFixed(2)}/hr`;
    case "spofCount":
      return String(v);
    default:
      return `${fmtRps(v)}/s`;
  }
}

/** Short machine-style criterion, e.g. "error rate ≤ 1.0%". */
export function criterion(o: Objective): string {
  if (o.metric === "componentLoad") return o.label.toLowerCase();
  return `${METRIC_NAME[o.metric] ?? o.metric} ${OP[o.op]} ${fmtValue(o, o.value)}`;
}

export function CriterionChip({ objective, result }: { objective: Objective; result?: ObjectiveResult }) {
  const got = result && result.actual !== null && objective.metric !== "componentLoad" ? ` · got ${fmtValue(objective, result.actual)}` : "";
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10.5px]",
        !result && "bg-white/[0.05] text-muted-foreground",
        result?.met && "bg-status-ok/10 text-status-ok",
        result && !result.met && "bg-status-crit/10 text-status-crit",
      )}
    >
      {criterion(objective)}
      {got}
      {objective.metric === "componentLoad" && result && ` · ${formatMetric("componentLoad", result.actual)}`}
    </span>
  );
}

export function PassBadge({ passed }: { passed: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-px font-mono text-[10px] font-bold tracking-wider",
        passed ? "bg-status-ok/15 text-status-ok" : "bg-status-crit/15 text-status-crit",
      )}
    >
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

/** One line per test: name, PASS/FAIL and each criterion with what the run got. */
export function TestStatusLines({ tests }: { tests: TestResult[] }) {
  return (
    <ul className="space-y-1.5">
      {tests.map(({ test, passed, results }) => (
        <li key={test.id} className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-semibold">{test.title}</span>
          <PassBadge passed={passed} />
          {results.map((r) => (
            <CriterionChip key={r.objective.id} objective={r.objective} result={r} />
          ))}
        </li>
      ))}
    </ul>
  );
}

/** Test case cards for the description panel (before any run). */
export function TestCaseCard({ test, result }: { test: TestCase; result?: TestResult }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-white/[0.02] p-3">
      <div className="flex items-center gap-2">
        {result && (result.passed ? <Check className="size-3.5 text-status-ok" aria-label="Passed" /> : <X className="size-3.5 text-status-crit" aria-label="Failed" />)}
        <p className="text-[13px] font-semibold">{test.title}</p>
      </div>
      <p className="text-[11.5px] text-muted-foreground">{test.detail}</p>
      <div className="flex flex-wrap gap-1">
        {test.objectives.map((o) => (
          <CriterionChip key={o.id} objective={o} result={result?.results.find((r) => r.objective.id === o.id)} />
        ))}
      </div>
    </div>
  );
}
