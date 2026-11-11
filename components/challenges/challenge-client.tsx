"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, Eye, Loader2, PanelLeft, Play, RotateCcw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Challenge } from "@/lib/challenges/types";
import { scoreChallenge } from "@/lib/challenges/score";
import { lockGraph, percentilesOf, simulate, type SimGraph, type SimResult } from "@/lib/sim";
import { perHour, runTests, testCasesFor, type TestResult } from "@/lib/challenges/test-cases";
import { INCIDENTS } from "@/data/challenges/incidents";
import { runHiddenTests, type HiddenResult } from "@/lib/challenges/hidden";
import { PROGRESS_EVENT, getRepo, type ChallengeRecord, type DesignDoc } from "@/lib/storage";
import { Button, buttonVariants } from "@/components/ui/button";
import { Designer } from "@/components/lab/designer";
import { ResizeHandle, usePanelWidth } from "@/components/lab/resize-handle";
import { ShareButton } from "@/components/lab/share-button";
import { LoadDesignButton, ResetButton, SaveDesignButton, type CurrentDesign } from "@/components/lab/design-actions";
import { ObjectiveList, ScoreCard } from "./score-card";
import { StartGuide, TestsPreview } from "./start-guide";
import { ProblemPanel, type ProblemTab } from "./problem-panel";
import { PassBadge, TestStatusLines } from "./test-results";
import { cn } from "@/lib/utils";
import { sameGraph } from "@/lib/grading/grade";
import { SOLVE_PROBLEM, SOLVE_STEPS, TOUR_DONE_KEY, TOUR_STEPS, WorkspaceTour } from "./workspace-tour";
import { verifySubmission, type Verification } from "@/lib/grading/client";

type Phase = { phase: "loading" } | { phase: "error"; message: string } | { phase: "ready"; doc: DesignDoc; key: number };

function startingDoc(ch: Challenge): DesignDoc {
  return { ...structuredClone(ch.startingDesign), traffic: { ...ch.traffic } };
}

export function ChallengeClient({ challenge, next }: { challenge: Challenge; next?: { id: string; title: string } }) {
  const isBuild = challenge.mode === "build";
  const basePath = isBuild ? "/build" : "/challenges";
  const noun = isBuild ? "problem" : "challenge";
  const draftScope = `challenge:${challenge.id}`;
  const [state, setState] = useState<Phase>({ phase: "loading" });
  const [record, setRecord] = useState<ChallengeRecord | null>(null);
  const [current, setCurrent] = useState<CurrentDesign | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [editorialOpen, setEditorialOpen] = useState(false);
  const [problemTab, setProblemTab] = useState<ProblemTab>("description");
  const [leftOpen, setLeftOpen] = useState(true);
  const problemRef = useRef<HTMLElement>(null);
  const problemWidth = usePanelWidth({ min: 260, max: 560 });
  const [testFilter, setTestFilter] = useState<string>("all");
  // Server-side check of the last submission (what the leaderboard counts).
  const [verification, setVerification] = useState<Verification | "checking" | null>(null);
  const [submission, setSubmission] = useState<{
    tests: TestResult[];
    hidden: HiddenResult[];
    score: number;
    passed: boolean;
    xp: number;
    p99: number;
    cost: number;
  } | null>(null);
  const incident = challenge.mode === "build" ? undefined : INCIDENTS[challenge.id];
  // Guided tour: opens by itself the first time someone lands on any problem, then from the Tour button.
  const [tourOpen, setTourOpen] = useState(false);
  // "tour" walks the controls; "solve" builds a real solution on the canvas (The Overloaded Database).
  const [tourMode, setTourMode] = useState<"tour" | "solve">("tour");
  const canSolve = challenge.id === SOLVE_PROBLEM;
  const tests = useMemo(() => testCasesFor(challenge), [challenge]);
  const latencyObjective = challenge.objectives.find((o) => o.metric === "avgLatencyMs");
  const budget = challenge.objectives.find((o) => o.metric === "monthlyCost")?.value;
  const draftWarned = useRef(false);
  const router = useRouter();
  const watchSolve = useCallback(() => {
    if (challenge.id === SOLVE_PROBLEM) {
      setTourMode("solve");
      setTourOpen(true);
    } else router.push(`/challenges/${SOLVE_PROBLEM}?solve=1`);
  }, [challenge.id, router]);
  const nextHref = next ? `${basePath}/${next.id}` : null;
  const params = useSearchParams();
  // Read ?design= once: clearing it from the URL afterwards must not reload the draft over it.
  const [designParam] = useState(() => params.get("design"));

  const boot = useCallback(() => {
    let cancelled = false;
    const repo = getRepo();
    Promise.all([repo.getDraft(draftScope), repo.getProgress(), designParam ? repo.listDesigns() : Promise.resolve([])]).then(
      ([draft, progress, designs]) => {
        if (cancelled) return;
        const saved = designs.find((d) => d.id === designParam && d.challengeId === challenge.id);
        if (designParam) {
          if (!saved) toast.error("That saved design no longer exists.");
          router.replace(`${basePath}/${challenge.id}`);
        }
        // Traffic is always the challenge's, even if an old draft or save says otherwise.
        const base = saved ?? draft;
        const doc = base ? { graph: base.graph, positions: base.positions, traffic: { ...challenge.traffic } } : startingDoc(challenge);
        if (saved) setCurrent({ id: saved.id, name: saved.name });
        setRecord(progress.challenges[challenge.id] ?? null);
        setState({ phase: "ready", doc, key: Date.now() });
        let toured = false;
        try {
          toured = localStorage.getItem(TOUR_DONE_KEY) === "1";
        } catch {
          /* private mode */
        }
        // Arriving from "Watch a full solve": start the guided solve. Otherwise, first visit: the tour.
        const solveNow = challenge.id === SOLVE_PROBLEM && new URLSearchParams(window.location.search).get("solve") === "1";
        if (solveNow) {
          setTourMode("solve");
          setTimeout(() => setTourOpen(true), 900);
        } else if (!toured) setTimeout(() => setTourOpen(true), 600);
      },
      (e: unknown) => {
        if (!cancelled) setState({ phase: "error", message: e instanceof Error ? e.message : "Could not read saved data." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [challenge, draftScope, designParam, router, basePath]);

  useEffect(() => boot(), [boot]);

  const saveDraft = useCallback(
    (doc: DesignDoc) => {
      getRepo()
        .setDraft(draftScope, doc)
        .catch((e: unknown) => {
          if (!draftWarned.current) {
            draftWarned.current = true;
            toast.error(e instanceof Error ? e.message : "Autosave failed.");
          }
        });
    },
    [draftScope],
  );

  const testsFor = useCallback(
    (result: SimResult, graph: SimGraph) => runTests(tests, scoreChallenge(challenge, result, graph).objectives),
    [tests, challenge],
  );

  /** Grade the design against every test, record the attempt and show the verdict. */
  const submit = useCallback(
    async (submittedGraph: SimGraph) => {
      // Grade with catalog capacity, latency and cost, whatever the design carries (old saves, edited storage).
      // ...and always against the brief's traffic, even if the canvas ran a what-if load.
      const graph = lockGraph(submittedGraph);
      const result = simulate(graph, challenge.traffic);
      const monthlyCost = result.monthlyCost;
      const s = scoreChallenge(challenge, result, graph);
      const results = runTests(tests, s.objectives);
      // Hidden tests only run on Submit; a problem counts as solved only when they pass too.
      const hidden = runHiddenTests(graph, challenge.traffic);
      const passed = s.passed && hidden.every((h) => h.passed);
      const p99 = percentilesOf(result).p99;
      const verdict = { tests: results, hidden, score: s.total, passed, xp: 0, p99, cost: monthlyCost };
      // The reference design, run unchanged, is a worked example: grade it, but don't record it or award XP.
      if (challenge.reference && sameGraph(graph, challenge.reference.graph)) {
        setSubmission(verdict);
        setVerification(null);
        toast.info("That's the revealed solution, unchanged. Change something to make it yours and mark it solved.");
        return;
      }
      try {
        const { progress, xpGained } = await getRepo().recordAttempt(challenge.id, s.total, passed, {
          testsPassed: results.filter((r) => r.passed).length + hidden.filter((h) => h.passed).length,
          testsTotal: results.length + hidden.length,
          p99Ms: p99,
          monthlyCost,
        });
        const rec = progress.challenges[challenge.id];
        const firstPass = passed && rec.firstPassedAt === rec.lastAttemptAt;
        setRecord(rec);
        setSubmission({ ...verdict, xp: xpGained });
        // Signed-in users: re-grade on the server so the result counts on the leaderboard.
        setVerification("checking");
        void verifySubmission(challenge.id, graph).then(setVerification);
        window.dispatchEvent(new Event(PROGRESS_EVENT));
        if (firstPass) {
          toast.success(`Accepted! Score ${s.total}. +${xpGained} XP`, {
            description: next ? `Up next: ${next.title}` : `That was the last ${noun}. Nice work!`,
            ...(nextHref ? { action: { label: "Next →", onClick: () => router.push(nextHref) } } : {}),
            duration: 8000,
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not record your attempt.");
      }
    },
    [challenge, tests, next, nextHref, noun, router],
  );

  const pendingObjectives = useMemo(
    () => challenge.objectives.map((objective) => ({ objective, actual: null, met: false })),
    [challenge],
  );

  const visibleTests = (all: TestResult[]) => (testFilter === "all" ? all : all.filter((r) => r.test.id === testFilter));

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-none flex-col overflow-hidden md:h-[calc(100dvh-3rem)]">
      <WorkspaceTour
        key={tourMode}
        open={tourOpen}
        steps={tourMode === "solve" ? SOLVE_STEPS : TOUR_STEPS}
        onClose={() => {
          setTourOpen(false);
          setTourMode("tour");
        }}
        onWatchSolve={tourMode === "tour" ? watchSolve : undefined}
      />
      {state.phase === "loading" && (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading {noun}…
        </div>
      )}
      {state.phase === "error" && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-sm space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-center">
            <p className="text-sm font-medium">Couldn&apos;t load your progress</p>
            <p className="text-xs text-muted-foreground">{state.message}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setState({ phase: "loading" });
                boot();
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )}
      {state.phase === "ready" && (
        <Designer
          key={state.key}
          initial={state.doc}
          allowedKinds={challenge.allowedComponents}
          trafficLocked
          specsLocked
          brief={challenge.requirements}
          onDocChange={saveDraft}
          // Fix challenges: run the broken system once on load, so it's visibly failing on the canvas.
          autoRun={Boolean(incident)}
          latencyTarget={latencyObjective ? { ms: latencyObjective.value, label: `target avg ≤ ${latencyObjective.value} ms` } : undefined}
          header={(ctx) => {
            const overBudget = budget !== undefined && ctx.monthlyCost > budget;
            return (
              <div className="shrink-0 border-b border-border bg-sidebar/80">
                <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <Button variant="outline" size="sm" className="max-lg:hidden" onClick={() => setLeftOpen((o) => !o)} aria-pressed={leftOpen} title="Show or hide the problem panel">
                    <PanelLeft /> Layout
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTourMode("tour");
                      setTourOpen(true);
                    }}
                    title="A quick walkthrough of this page"
                  >
                    <Compass /> <span className="max-sm:hidden">Tour</span>
                  </Button>
                  {canSolve && (
                    <Button variant="outline" size="sm" onClick={watchSolve} title="Build the solution together, step by step">
                      <Wand2 /> <span className="max-sm:hidden">Solve it with me</span>
                    </Button>
                  )}
                  <Link href={basePath} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label={isBuild ? "Back to build problems" : "Back to challenges"}>
                    <ArrowLeft />
                  </Link>
                  <span className="hidden font-mono text-[11.5px] text-muted-foreground sm:inline">
                    {isBuild ? challenge.category : `#${String(challenge.order).padStart(2, "0")}`} ·
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold",
                      incident ? "bg-status-crit/15 text-status-crit" : isBuild ? "bg-brand-cyan/15 text-brand-cyan" : "bg-brand-blue/15 text-brand-blue",
                    )}
                  >
                    {incident ? "On-call" : isBuild ? "Build" : "Design"}
                  </span>
                  <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{challenge.title}</h1>
                  <span
                    className={cn(
                      "text-[12.5px] font-medium",
                      challenge.difficulty === "Easy" ? "text-status-ok" : challenge.difficulty === "Medium" ? "text-status-warn" : "text-status-crit",
                    )}
                  >
                    {challenge.difficulty}
                  </span>
                  {record?.passed && (
                    <span className="flex items-center gap-1 rounded-full bg-status-ok/12 px-2 py-0.5 text-[11px] font-medium text-status-ok">
                      <CheckCircle2 className="size-3" aria-hidden="true" /> Solved
                    </span>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {record?.passed && nextHref && (
                      <Link
                        href={nextHref}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-w-[240px] text-status-ok hover:text-status-ok")}
                        title={`Next ${noun}: ${next!.title}`}
                      >
                        <span className="truncate">Next: {next!.title}</span> <ArrowRight />
                      </Link>
                    )}
                    <span className={cn("font-mono text-[12px] tabular-nums max-sm:mr-auto", overBudget ? "text-status-crit" : "text-muted-foreground")} title="Monthly cost ÷ 730 hours">
                      ${perHour(ctx.monthlyCost).toFixed(2)}/hr{budget !== undefined && <> of ${perHour(budget).toFixed(2)}</>}
                    </span>
                    <label className="sr-only" htmlFor="test-filter">
                      Test case
                    </label>
                    <select
                      id="test-filter"
                      value={testFilter}
                      onChange={(e) => setTestFilter(e.target.value)}
                      className="h-8 rounded-lg border border-border bg-background px-2 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden"
                    >
                      <option value="all">All tests ({tests.length})</option>
                      {tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                    <Button variant="outline" size="sm" data-tour="run" onClick={() => ctx.run()} title="Run 60 seconds of traffic (⌘↵)">
                      <Play /> Run
                    </Button>
                    <Button
                      size="sm"
                      data-tour="submit"
                      onClick={() => {
                        const r = ctx.run();
                        if (!r) return;
                        ctx.showConsoleTab("submission");
                        void submit(ctx.getDoc().graph);
                      }}
                      title="Grade your design against every test"
                    >
                      Submit
                    </Button>
                    <ResetButton
                      title={isBuild ? "Start over?" : "Reset challenge?"}
                      description={isBuild ? "Clears the canvas back to just your users. Your best score and saved designs are kept." : "Restores the starting design. Your best score and saved designs are kept."}
                      trigger={<RotateCcw aria-label="Reset" />}
                      options={[
                        {
                          label: "Reset to start",
                          destructive: true,
                          onSelect: () => {
                            ctx.loadDoc(startingDoc(challenge));
                            setCurrent(null);
                          },
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            );
          }}
          leftPanel={
            (
              <aside
                ref={problemRef}
                data-tour="problem"
                className={cn(
                  "relative h-full shrink-0 overflow-hidden bg-sidebar/40 lg:h-auto lg:w-[var(--problem-w)] lg:overflow-visible lg:border-r lg:border-border",
                  !leftOpen && "lg:hidden",
                )}
                style={{ ["--problem-w" as string]: `${problemWidth.width ?? 320}px` }}
              >
                <ResizeHandle
                  label="Resize problem panel"
                  getWidth={() => problemRef.current?.offsetWidth ?? 320}
                  onResize={problemWidth.setWidth}
                  onReset={problemWidth.reset}
                />
                <div className="h-full overflow-hidden">
                <ProblemPanel
                  challenge={challenge}
                  tab={problemTab}
                  onTabChange={setProblemTab}
                  tests={tests}
                  testResults={submission?.tests ?? null}
                  record={record}
                  hintsShown={hintsShown}
                  onRevealHint={() => setHintsShown((n) => n + 1)}
                  editorialOpen={editorialOpen}
                  onRevealEditorial={() => setEditorialOpen(true)}
                  pager={incident?.page}
                />
                </div>
              </aside>
            )
          }
          canvasOverlay={({ getDoc, result }) =>
            isBuild && !result && getDoc().graph.nodes.length <= 1 ? (
              <StartGuide challenge={challenge} />
            ) : null
          }
          consoleIdle={<TestsPreview tests={tests} />}
          consoleBadge={({ result, getDoc }) => {
            if (!result) return null;
            const all = testsFor(result, getDoc().graph);
            const ok = all.filter((x) => x.passed).length;
            return (
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold",
                  ok === all.length ? "bg-status-ok/12 text-status-ok" : "bg-status-crit/12 text-status-crit",
                )}
              >
                {ok}/{all.length} tests passing
              </span>
            );
          }}
          consoleStatus={({ result, getDoc }) => (result ? <TestStatusLines tests={visibleTests(testsFor(result, getDoc().graph))} /> : null)}
          consoleTabs={[
            {
              id: "submission",
              label: submission ? `Submission · ${submission.score}` : "Submission",
              content: submission ? (
                <div className="space-y-3">
                  <div className={cn("rounded-xl border p-4", submission.passed ? "border-status-ok/35 bg-status-ok/[0.06]" : "border-status-crit/35 bg-status-crit/[0.06]")}>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className={cn("text-2xl font-semibold tracking-tight", submission.passed ? "text-status-ok" : "text-status-crit")}>
                        {submission.passed ? "Accepted" : "Failed"}
                      </p>
                      <p className="font-mono text-[12px] text-muted-foreground">
                        {submission.tests.filter((t) => t.passed).length + submission.hidden.filter((h) => h.passed).length}/{submission.tests.length + submission.hidden.length} tests · score {submission.score} · ${perHour(submission.cost).toFixed(2)}/hr · p99{" "}
                        {submission.p99 >= 1000 ? `${(submission.p99 / 1000).toFixed(1)} s` : `${Math.round(submission.p99)} ms`}
                      </p>
                      {submission.xp > 0 && <span className="rounded bg-brand-blue/15 px-1.5 py-px font-mono text-[11px] text-brand-blue">+{submission.xp} XP</span>}
                      {verification && verification !== "unavailable" && (
                        <span
                          className={cn(
                            "w-full text-[11.5px]",
                            verification === "verified" ? "text-status-ok" : verification === "failed" ? "text-status-warn" : "text-muted-foreground",
                          )}
                        >
                          {verification === "checking"
                            ? "Verifying on the server…"
                            : verification === "verified"
                              ? "✓ Verified on the server · counts on the leaderboard"
                              : verification === "failed"
                                ? "Couldn't verify on the server. Submit again to count on the leaderboard."
                                : "Saved in this browser. Sign in to count on the leaderboard."}
                        </span>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {submission.tests.map((t) => (
                      <li key={t.test.id} className="rounded-xl border border-border bg-white/[0.02] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <PassBadge passed={t.passed} />
                          <span className="text-[13px] font-semibold">{t.test.title}</span>
                          <span className="text-[11.5px] text-muted-foreground">{t.test.detail}</span>
                        </div>
                        <div className="mt-1.5">
                          <TestStatusLines tests={[{ ...t, test: { ...t.test, title: "" } }]} />
                        </div>
                      </li>
                    ))}
                    {submission.hidden.map((h, i) => (
                      <li key={h.test.id} className="rounded-xl border border-border bg-white/[0.02] px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <PassBadge passed={h.passed} />
                          <span className="text-[13px] font-semibold">{h.passed ? `Hidden test ${i + 1}` : h.test.title}</span>
                          <span className="rounded bg-white/[0.06] px-1.5 font-mono text-[10px] text-muted-foreground">hidden</span>
                          <span className="text-[11.5px] text-muted-foreground">{h.passed ? "Passed" : `Revealed because it failed · error rate ${(h.errorRate * 100).toFixed(1)}%`}</span>
                        </div>
                        {!h.passed && <p className="mt-1.5 text-[12px] text-status-crit">{h.test.detail}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="py-6 text-center text-[12.5px] text-muted-foreground">Press Submit to grade your design against every test, including hidden ones, and record your score.</p>
              ),
            },
          ]}
          resultsExtra={({ getDoc, result, stale }) =>
            result ? (
              <>
                {record?.passed && (
                  <section className="flex items-center gap-2 rounded-xl border border-status-ok/30 bg-status-ok/10 p-3 text-xs">
                    <CheckCircle2 className="size-4 shrink-0 text-status-ok" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="font-semibold">Solved</span> · best {record.bestScore}
                    </span>
                    {nextHref && (
                      <Link href={nextHref} className={buttonVariants({ size: "xs" })}>
                        Next {noun} <ArrowRight />
                      </Link>
                    )}
                  </section>
                )}
                <ScoreCard score={scoreChallenge(challenge, result, getDoc().graph)} stale={stale} />
              </>
            ) : (
              <section className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
                <h3 className="text-xs font-semibold">Objectives</h3>
                <ObjectiveList results={pendingObjectives} pending />
              </section>
            )
          }
          actions={({ getDoc, loadDoc }) => (
            <>
              <SaveDesignButton
                getDoc={getDoc}
                current={current}
                challengeId={challenge.id}
                defaultName={`${challenge.title} ${isBuild ? "design" : "attempt"}`}
                onSaved={(d) => setCurrent({ id: d.id, name: d.name })}
              />
              <ShareButton getDoc={getDoc} defaultName={`${challenge.title} design`} challengeId={challenge.id} />
              <LoadDesignButton
                filter={(d) => d.challengeId === challenge.id}
                onLoad={(d) => {
                  loadDoc({ ...d, traffic: { ...challenge.traffic } });
                  setCurrent({ id: d.id, name: d.name });
                }}
              />
              {challenge.reference && (
                <ResetButton
                  title="Reveal the solution?"
                  description="Replaces the canvas with a design that meets every objective. Undo brings yours back. Submitting it unchanged grades it but doesn't mark the problem solved; change something to make it yours."
                  trigger={
                    <>
                      <Eye /> Reveal solution
                    </>
                  }
                  options={[
                    {
                      label: "Reveal solution",
                      onSelect: () => {
                        loadDoc({ ...structuredClone(challenge.reference!), traffic: { ...challenge.traffic } });
                        setCurrent(null);
                      },
                    },
                  ]}
                />
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
