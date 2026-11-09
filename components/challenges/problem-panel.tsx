"use client";

import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, ChevronRight, Eye, Lightbulb, Siren, X } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import type { TestCase, TestResult } from "@/lib/challenges/test-cases";
import { perHour } from "@/lib/challenges/test-cases";
import { CATALOG } from "@/lib/sim";
import type { ChallengeRecord } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { fmtLatency } from "@/components/lab/run-console";
import { HiddenTestCards, TestCaseCard } from "./test-results";
import { HIDDEN_TESTS } from "@/lib/challenges/hidden";

export type ProblemTab = "description" | "hints" | "editorial" | "submissions";

function Collapsible({ title, count, children, defaultOpen = true }: { title: string; count?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border py-4 last:border-b-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-1.5 text-left">
        {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
        <h2 className="flex-1 text-[14px] font-semibold">{title}</h2>
        {count !== undefined && <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[10.5px] text-muted-foreground">{count}</span>}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function ReqList({ items, tone }: { items: string[]; tone: string }) {
  return (
    <ul className="space-y-1.5">
      {items.map((r) => (
        <li key={r} className="flex gap-2 text-[13px] leading-snug">
          <ChevronRight className={cn("mt-0.5 size-3.5 shrink-0", tone)} aria-hidden="true" />
          {r}
        </li>
      ))}
    </ul>
  );
}

export function ProblemPanel({
  challenge,
  tab,
  onTabChange,
  tests,
  testResults,
  record,
  hintsShown,
  onRevealHint,
  editorialOpen,
  onRevealEditorial,
  onShowPage,
}: {
  challenge: Challenge;
  tab: ProblemTab;
  onTabChange: (t: ProblemTab) => void;
  tests: TestCase[];
  testResults: TestResult[] | null;
  record: ChallengeRecord | null;
  hintsShown: number;
  onRevealHint: () => void;
  editorialOpen: boolean;
  onRevealEditorial: () => void;
  /** Re-open the on-call page (fix challenges with an incident). */
  onShowPage?: () => void;
}) {
  const req = challenge.requirements;
  const budget = challenge.objectives.find((o) => o.metric === "monthlyCost")?.value;
  const history = record?.history ?? [];
  const tabs: Array<{ id: ProblemTab; label: string }> = [
    { id: "description", label: "Description" },
    { id: "hints", label: `Hints (${challenge.hints.length})` },
    { id: "editorial", label: "Editorial" },
    { id: "submissions", label: `Submissions${history.length ? ` (${history.length})` : ""}` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Problem" className="flex shrink-0 overflow-x-auto border-b border-border px-2 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              "relative h-10 shrink-0 px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
              tab === t.id && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {tab === "description" && (
          <>
            <Collapsible title="Problem">
              <div className="space-y-2.5">
                {challenge.scenario.map((p) => (
                  <p key={p} className="text-[13.5px] leading-relaxed text-foreground/90">
                    {p}
                  </p>
                ))}
                {onShowPage && (
                  <Button variant="outline" size="xs" onClick={onShowPage}>
                    <Siren /> Show the on-call page
                  </Button>
                )}
              </div>
            </Collapsible>
            {req && (
              <Collapsible title="Requirements" count={req.functional.length + req.nonFunctional.length}>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Functional</h3>
                    <ReqList items={req.functional} tone="text-brand-blue" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Non-functional</h3>
                    <ReqList items={req.nonFunctional} tone="text-brand-cyan" />
                  </div>
                </div>
              </Collapsible>
            )}
            {challenge.estimates && (
              <Collapsible title="Back-of-envelope" count={challenge.estimates.length} defaultOpen={false}>
                <ul className="space-y-1 rounded-lg border border-border bg-white/[0.02] p-2.5 font-mono text-[11.5px] leading-relaxed">
                  {challenge.estimates.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Collapsible>
            )}
            <Collapsible title="Test cases" count={`${testResults ? `${testResults.filter((r) => r.passed).length}/` : ""}${tests.length} + ${HIDDEN_TESTS.length} hidden`}>
              <div className="space-y-2">
                {tests.map((t) => (
                  <TestCaseCard key={t.id} test={t} result={testResults?.find((r) => r.test.id === t.id)} />
                ))}
                <HiddenTestCards />
                {budget !== undefined && (
                  <p className="pt-1 font-mono text-[11.5px] text-muted-foreground">
                    Budget: <span className="text-foreground">${perHour(budget).toFixed(2)}/hr</span> (${budget.toLocaleString("en-US")}/mo)
                  </p>
                )}
              </div>
            </Collapsible>
            {challenge.mode !== "build" && (
              <Collapsible title="Allowed components" count={challenge.allowedComponents.length} defaultOpen={false}>
                <ul className="flex flex-wrap gap-1">
                  {challenge.allowedComponents.map((k) => (
                    <li key={k} className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                      {CATALOG[k].label}
                    </li>
                  ))}
                </ul>
              </Collapsible>
            )}
          </>
        )}

        {tab === "hints" && (
          <div className="space-y-3 py-4">
            <p className="text-[12.5px] text-muted-foreground">Hints get more specific as you reveal them.</p>
            <ol className="space-y-2">
              {challenge.hints.slice(0, hintsShown).map((h, i) => (
                <li key={h} className="flex gap-2 rounded-lg border border-status-warn/25 bg-status-warn/5 p-3 text-[13px] leading-relaxed">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-status-warn" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">Hint {i + 1}. </span>
                    {h}
                  </span>
                </li>
              ))}
            </ol>
            {hintsShown < challenge.hints.length && (
              <Button variant="outline" size="sm" onClick={onRevealHint}>
                <Lightbulb /> Reveal hint {hintsShown + 1} of {challenge.hints.length}
              </Button>
            )}
          </div>
        )}

        {tab === "editorial" && (
          <div className="space-y-3 py-4">
            {editorialOpen || record?.passed ? (
              <>
                <h2 className="flex items-center gap-2 text-[14px] font-semibold">
                  <BookOpen className="size-4 text-brand-blue" aria-hidden="true" /> How to think about it
                </h2>
                {challenge.explanation.map((p) => (
                  <p key={p} className="text-[13.5px] leading-relaxed text-foreground/90">
                    {p}
                  </p>
                ))}
                {challenge.reference && (
                  <p className="rounded-lg border border-border bg-white/[0.02] p-3 text-[12px] text-muted-foreground">
                    Want to see it built? Use <span className="font-medium text-foreground">Reveal solution</span> in the canvas toolbar.
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-3 rounded-xl border border-dashed border-border p-5 text-center">
                <BookOpen className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-[13px] font-medium">The editorial explains a working solution</p>
                <p className="text-[12px] text-muted-foreground">It unlocks when you pass. You can read it now, and still earn full XP afterwards.</p>
                <Button variant="outline" size="sm" onClick={onRevealEditorial}>
                  <Eye /> Read anyway
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "submissions" && (
          <div className="py-4">
            {history.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-[12.5px] text-muted-foreground">
                No submissions yet. Press Submit to grade your design against every test.
              </p>
            ) : (
              <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {history.map((h) => (
                  <li key={h.at} className="flex items-center gap-3 px-3 py-2.5 text-[12.5px]">
                    {h.passed ? <Check className="size-4 shrink-0 text-status-ok" aria-hidden="true" /> : <X className="size-4 shrink-0 text-status-crit" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-semibold", h.passed ? "text-status-ok" : "text-status-crit")}>{h.passed ? "Accepted" : "Failed"}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{fmtDate(h.at)}</p>
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted-foreground">
                      <p className="text-foreground">score {h.score}</p>
                      <p>
                        {h.testsTotal !== undefined && `${h.testsPassed}/${h.testsTotal} tests`}
                        {h.p99Ms != null && ` · p99 ${fmtLatency(h.p99Ms)}`}
                        {h.monthlyCost !== undefined && ` · $${perHour(h.monthlyCost).toFixed(2)}/hr`}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
