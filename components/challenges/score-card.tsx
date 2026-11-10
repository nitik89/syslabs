"use client";

import { CheckCircle2, CircleX, Trophy } from "lucide-react";
import type { ChallengeScore, ObjectiveResult } from "@/lib/challenges/score";
import type { ObjectiveMetric, ScoreCategory } from "@/lib/challenges/types";
import { fmtMs, fmtPct, fmtRps, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SimulatedTag } from "@/components/lab/metrics-panel";

const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  performance: "Performance",
  reliability: "Reliability",
  cost: "Cost",
  architecture: "Architecture",
};

export function formatMetric(metric: ObjectiveMetric, v: number | null): string {
  if (v === null) return "n/a";
  switch (metric) {
    case "errorRate":
    case "cacheHitRatio":
    case "maxUtilization":
      return fmtPct(v, metric === "errorRate" ? 2 : 0);
    case "avgLatencyMs":
      return fmtMs(v);
    case "monthlyCost":
      return fmtUsd(v);
    case "spofCount":
      return String(v);
    case "componentLoad":
      return v > 0 ? `in use (${fmtRps(v)} rps)` : "missing";
    case "unsafeWriteRps":
      return v === 0 ? "0 (safe)" : `${fmtRps(v)} rps unsafe`;
    default:
      return `${fmtRps(v)} rps`;
  }
}

function scoreTone(s: number) {
  return s >= 80 ? "text-status-ok" : s >= 50 ? "text-status-warn" : "text-status-crit";
}
function barTone(s: number) {
  return s >= 80 ? "bg-status-ok" : s >= 50 ? "bg-status-warn" : "bg-status-crit";
}

export function ObjectiveList({ results, pending }: { results: ObjectiveResult[]; pending?: boolean }) {
  return (
    <ul className="space-y-1.5">
      {results.map(({ objective, actual, met }) => (
        <li key={objective.id} className="flex items-start gap-2 text-[12px]">
          {pending ? (
            <span className="mt-0.5 size-3.5 shrink-0 rounded-full border border-muted-foreground/50" aria-hidden="true" />
          ) : met ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-status-ok" aria-hidden="true" />
          ) : (
            <CircleX className="mt-0.5 size-3.5 shrink-0 text-status-crit" aria-hidden="true" />
          )}
          <span className="flex-1">
            <span className="sr-only">{pending ? "Not checked yet: " : met ? "Met: " : "Not met: "}</span>
            {objective.label}
            {!pending && <span className="ml-1 font-mono text-[11px] text-muted-foreground">({formatMetric(objective.metric, actual)})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Circular gauge for the 0–100 score. */
function ScoreRing({ value, passed }: { value: number; passed: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = passed ? "var(--status-ok)" : value >= 50 ? "var(--status-warn)" : "var(--status-crit)";
  return (
    <div className="relative size-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="color-mix(in oklch, var(--ink) 8%, transparent)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none">{value}</span>
        <span className="text-[9px] text-muted-foreground">/ 100</span>
      </span>
    </div>
  );
}

export function ScoreCard({ score, stale }: { score: ChallengeScore; stale: boolean }) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border p-4",
        score.passed ? "border-status-ok/35 bg-gradient-to-br from-status-ok/10 to-transparent" : "surface",
        stale && "opacity-60",
      )}
      aria-label="Challenge score"
    >
      <div className="flex items-center gap-4">
        <ScoreRing value={score.total} passed={score.passed} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            {score.passed ? <Trophy className="size-4 text-status-ok" aria-hidden="true" /> : <CircleX className="size-4 text-status-crit" aria-hidden="true" />}
            <span className={cn("text-sm font-semibold", score.passed ? "text-status-ok" : "text-status-crit")}>{score.passed ? "Passed" : "Not passed yet"}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {score.objectives.filter((o) => o.met).length} of {score.objectives.length} objectives met
          </p>
          <SimulatedTag />
        </div>
      </div>
      <ul className="space-y-2">
        {score.categories.map((c) => (
          <li key={c.category} className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span>
                {CATEGORY_LABEL[c.category]} <span className="text-muted-foreground">· weight {Math.round(c.weight * 100)}%</span>
              </span>
              <span className={cn("font-mono", scoreTone(c.score))}>{c.score}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-secondary">
              <div className={cn("h-full", barTone(c.score))} style={{ width: `${c.score}%` }} />
            </div>
            {c.notes.length > 0 && (
              <ul className="space-y-0.5">
                {c.notes.map((n) => (
                  <li key={n} className="text-[11px] text-muted-foreground">
                    · {n}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <div className="space-y-1.5 border-t border-border pt-3">
        <h3 className="text-xs font-semibold">Objectives</h3>
        <ObjectiveList results={score.objectives} />
      </div>
    </section>
  );
}
