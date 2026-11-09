"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, BookOpen, Calculator, CheckCircle2, Clock, ListChecks, Play, RotateCcw, Send, Zap } from "lucide-react";
import { toast } from "sonner";
import type { MockInterview } from "@/data/interviews";
import type { Challenge } from "@/lib/challenges/types";
import { getRepo, type DesignDoc } from "@/lib/storage";
import {
  buildScorecard,
  scoreDesignAndTwist,
  scoreEstimation,
  scoreRequirements,
  scoreTime,
  twistScenario,
  type InterviewAnswers,
  type Scorecard,
} from "@/lib/interview/score";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Designer } from "@/components/lab/designer";

type Stage = "brief" | "requirements" | "estimates" | "twist";
const TWIST_AT_MIN = 30;

interface Saved {
  startedAt: number;
  answers: InterviewAnswers;
  twisted: boolean;
  doc: DesignDoc;
}

const storeKey = (id: string) => `syslab:interview:${id}`;
const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

function LinesInput({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        {label}
      </label>
      <p className="text-[11.5px] text-muted-foreground">{hint}</p>
      <textarea
        id={id}
        rows={5}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        placeholder="One per line"
        className="w-full resize-y rounded-lg border border-border bg-white/[0.03] p-2.5 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function ScorecardView({ card, interview, problem, onRetry }: { card: Scorecard; interview: MockInterview; problem: Challenge; onRetry: () => void }) {
  const tone = card.level === "Not yet" ? "text-status-crit" : card.level === "E4" ? "text-status-warn" : "text-status-ok";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <Link href="/interview" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All mock interviews
      </Link>
      <header className="surface flex flex-wrap items-center gap-6 rounded-3xl p-6">
        <div className="flex size-24 flex-col items-center justify-center rounded-full border-4 border-brand-blue/30">
          <span className="text-3xl font-semibold tabular-nums">{card.total}</span>
          <span className="font-mono text-[10px] text-muted-foreground">/ 100</span>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mock interview · {problem.title}</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Performance: <span className={tone}>{card.level === "Not yet" ? "not yet at the bar" : `${card.level} bar`}</span>
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Target for this interview: {interview.level}. {card.level !== "Not yet" && card.level >= interview.level ? "You met it." : "Review the notes below and try again."}
          </p>
        </div>
      </header>
      <ul className="space-y-3">
        {card.parts.map((p) => (
          <li key={p.id} className="surface space-y-2 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="flex-1 text-[14px] font-semibold">{p.label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">weight {Math.round(p.weight * 100)}%</span>
              <span className={cn("w-12 text-right font-mono text-[15px] font-semibold", p.score >= 80 ? "text-status-ok" : p.score >= 50 ? "text-status-warn" : "text-status-crit")}>{p.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={cn("h-full rounded-full", p.score >= 80 ? "bg-status-ok" : p.score >= 50 ? "bg-status-warn" : "bg-status-crit")} style={{ width: `${p.score}%` }} />
            </div>
            <ul className="space-y-0.5 text-[12.5px] text-muted-foreground">
              {p.notes.map((n) => (
                <li key={n}>· {n}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetry}>
          <RotateCcw /> Try again
        </Button>
        <Link href={`/build/${problem.id}`} className={buttonVariants({ variant: "outline" })}>
          <BookOpen /> Study the problem and its editorial
        </Link>
      </div>
    </div>
  );
}

export function InterviewSession({ interview, problem }: { interview: MockInterview; problem: Challenge }) {
  const limitMs = interview.minutes * 60000;
  const [saved, setSaved] = useState<Saved | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [designKey, setDesignKey] = useState(0);
  const [stage, setStage] = useState<Stage>("brief");
  const [now, setNow] = useState(() => Date.now());
  const [card, setCard] = useState<Scorecard | null>(null);
  const docRef = useRef<DesignDoc | null>(null);
  const twistTraffic = useMemo(() => twistScenario(problem, interview.twist).traffic, [problem, interview.twist]);

  // Restore an interview in progress (refresh-safe).
  useEffect(() => {
    let alive = true;
    // Read after mount (the page is prerendered without storage), then render the restored session.
    void Promise.resolve().then(() => {
      if (!alive) return;
      try {
        const raw = localStorage.getItem(storeKey(interview.id));
        if (raw) {
          const s = JSON.parse(raw) as Saved;
          docRef.current = s.doc;
          setSaved(s);
        }
      } catch {
        /* start fresh */
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [interview.id]);

  const persist = useCallback(
    (next: Saved) => {
      setSaved(next);
      try {
        localStorage.setItem(storeKey(interview.id), JSON.stringify(next));
      } catch {
        /* storage full or private mode: the session still works, just not across refreshes */
      }
    },
    [interview.id],
  );

  useEffect(() => {
    if (!saved || card) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [saved, card]);

  const elapsed = saved ? now - saved.startedAt : 0;

  const revealTwist = useCallback(() => {
    if (!saved || saved.twisted) return;
    const doc = docRef.current ?? saved.doc;
    // The canvas reloads with the twist's traffic, so Run shows the new load.
    persist({ ...saved, twisted: true, doc: { ...doc, traffic: { ...twistTraffic } } });
    setDesignKey((k) => k + 1);
    setStage("twist");
    toast.warning(`Twist: ${interview.twist.title}`, { description: interview.twist.prompt, duration: 10000 });
  }, [saved, persist, twistTraffic, interview.twist]);

  // The interviewer brings the twist at minute 30 if you haven't asked for it.
  useEffect(() => {
    if (saved && !saved.twisted && !card && elapsed >= TWIST_AT_MIN * 60000) revealTwist();
  }, [saved, elapsed, card, revealTwist]);

  const start = () => {
    const doc: DesignDoc = { ...structuredClone(problem.startingDesign), traffic: { ...problem.traffic } };
    docRef.current = doc;
    persist({ startedAt: Date.now(), answers: { functional: [], nonFunctional: [], peakRps: null, readPct: null }, twisted: false, doc });
    setNow(Date.now());
    setStage("brief");
    setDesignKey((k) => k + 1);
  };

  const finish = async () => {
    if (!saved) return;
    const graph = (docRef.current ?? saved.doc).graph;
    const { design, twist } = scoreDesignAndTwist(problem, interview.twist, graph);
    const result = buildScorecard([
      scoreRequirements(saved.answers),
      scoreEstimation(saved.answers, problem.traffic),
      design,
      saved.twisted ? twist : { ...twist, score: 0, notes: ["You submitted before the twist, so it wasn't handled."] },
      scoreTime(Date.now() - saved.startedAt, interview.minutes),
    ]);
    setCard(result);
    localStorage.removeItem(storeKey(interview.id));
    try {
      await getRepo().saveInterview({
        id: `${interview.id}-${Date.now()}`,
        interviewId: interview.id,
        at: new Date().toISOString(),
        total: result.total,
        level: result.level,
        parts: result.parts.map((p) => ({ id: p.id, label: p.label, score: p.score })),
      });
    } catch {
      toast.error("Couldn't save this result to your history.");
    }
  };

  const reset = () => {
    localStorage.removeItem(storeKey(interview.id));
    setSaved(null);
    setCard(null);
    docRef.current = null;
  };

  const onDocChange = useCallback((doc: DesignDoc) => {
    docRef.current = doc;
    setSaved((s) => {
      if (!s) return s;
      const next = { ...s, doc };
      try {
        localStorage.setItem(storeKey(interview.id), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [interview.id]);

  if (!loaded) return null;
  if (card) return <ScorecardView card={card} interview={interview} problem={problem} onRetry={reset} />;

  if (!saved) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
        <Link href="/interview" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All mock interviews
        </Link>
        <header className="space-y-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">Mock interview · target {interview.level}</p>
          <h1 className="text-3xl font-semibold tracking-tight">Design {problem.title}</h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground">{problem.summary}</p>
        </header>
        <section className="surface space-y-4 rounded-2xl p-6">
          <h2 className="text-[15px] font-semibold">How it works</h2>
          <ol className="space-y-2.5 text-[13.5px]">
            {[
              [ListChecks, "Requirements", "Write the functional and non-functional requirements yourself. Nothing is given."],
              [Calculator, "Estimates", "Estimate peak requests per second and the read share."],
              [Play, "Design", "Build it on the canvas and run it as often as you like."],
              [Zap, "Twist", `At minute ${TWIST_AT_MIN} (or earlier if you ask), the interviewer changes something. Adapt.`],
              [Send, "Submit", `Finish within ${interview.minutes} minutes and get a scorecard.`],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof ListChecks;
              return (
                <li key={t as string} className="flex gap-3">
                  <I className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{t as string}. </span>
                    <span className="text-muted-foreground">{b as string}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="rounded-lg bg-white/[0.03] px-3 py-2 font-mono text-[11.5px] text-muted-foreground">
            Scored: requirements 15% · estimation 15% · design 40% · twist 20% · time 10%. 85+ meets the E6 bar, 70+ E5, 55+ E4.
          </p>
          <Button size="lg" onClick={start}>
            <Clock /> Start the {interview.minutes}-minute clock
          </Button>
        </section>
      </div>
    );
  }

  const remaining = limitMs - elapsed;
  const tabs: Array<{ id: Stage; label: string; locked?: boolean }> = [
    { id: "brief", label: "Brief" },
    { id: "requirements", label: "Requirements" },
    { id: "estimates", label: "Estimates" },
    { id: "twist", label: saved.twisted ? "Twist" : "Twist 🔒", locked: !saved.twisted },
  ];
  const setAnswers = (a: Partial<InterviewAnswers>) => persist({ ...saved, answers: { ...saved.answers, ...a } });

  const panel = (
    <aside className="h-full shrink-0 overflow-hidden bg-sidebar/40 lg:h-auto lg:w-[340px] lg:border-r lg:border-border">
      <div className="flex h-full min-h-0 flex-col">
        <div role="tablist" aria-label="Interview" className="flex shrink-0 border-b border-border px-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={stage === t.id}
              disabled={t.locked}
              onClick={() => setStage(t.id)}
              className={cn(
                "relative h-10 px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors enabled:hover:text-foreground disabled:opacity-50",
                stage === t.id && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {stage === "brief" && (
            <>
              <h2 className="text-[15px] font-semibold">{problem.title}</h2>
              {problem.scenario.map((p) => (
                <p key={p} className="text-[13.5px] leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
              <p className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground">
                Like a real interview, the requirements and numbers aren&apos;t handed to you. Pin them down in the next two tabs, then design.
              </p>
              <Button variant="outline" size="sm" onClick={() => setStage("requirements")}>
                Next: requirements
              </Button>
            </>
          )}
          {stage === "requirements" && (
            <>
              <LinesInput id="fr" label="Functional requirements" hint="What must the system do? Aim for 3 or more core features." value={saved.answers.functional} onChange={(v) => setAnswers({ functional: v })} />
              <LinesInput
                id="nfr"
                label="Non-functional requirements"
                hint="How well? Put numbers on them: scale, latency, availability, cost."
                value={saved.answers.nonFunctional}
                onChange={(v) => setAnswers({ nonFunctional: v })}
              />
              <Button variant="outline" size="sm" onClick={() => setStage("estimates")}>
                Next: estimates
              </Button>
            </>
          )}
          {stage === "estimates" && (
            <>
              <p className="text-[12.5px] text-muted-foreground">Back-of-envelope from the brief. Within 25% (load) and 10 points (read share) scores full marks.</p>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold">Peak requests per second</span>
                <input
                  type="number"
                  min={0}
                  value={saved.answers.peakRps ?? ""}
                  onChange={(e) => setAnswers({ peakRps: e.target.value === "" ? null : Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-border bg-white/[0.03] px-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold">Share of reads (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={saved.answers.readPct ?? ""}
                  onChange={(e) => setAnswers({ readPct: e.target.value === "" ? null : Number(e.target.value) })}
                  className="h-9 w-full rounded-lg border border-border bg-white/[0.03] px-2.5 font-mono text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <p className="rounded-lg bg-white/[0.03] p-3 text-[12px] text-muted-foreground">
                Now design on the canvas. Run as often as you like; the twist arrives at minute {TWIST_AT_MIN}.
              </p>
              {!saved.twisted && (
                <Button variant="outline" size="sm" onClick={revealTwist}>
                  <Zap /> I&apos;m ready: bring the twist now
                </Button>
              )}
            </>
          )}
          {stage === "twist" && saved.twisted && (
            <div className="space-y-3 rounded-xl border border-status-warn/40 bg-status-warn/[0.06] p-4">
              <p className="flex items-center gap-2 text-[14px] font-semibold text-status-warn">
                <AlertTriangle className="size-4" aria-hidden="true" /> {interview.twist.title}
              </p>
              <p className="text-[13.5px] leading-relaxed">{interview.twist.prompt}</p>
              {interview.twist.kind === "traffic" && (
                <p className="font-mono text-[12px] text-muted-foreground">
                  Peak is now {twistTraffic.rps.toLocaleString("en-US")} req/s. Run shows the new load.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-none flex-col overflow-hidden md:h-[calc(100dvh-3rem)]">
      <Designer
        key={designKey}
        initial={saved.doc}
        allowedKinds={problem.allowedComponents}
        trafficLocked
        specsLocked
        onDocChange={onDocChange}
        leftPanel={panel}
        header={(ctx) => (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-sidebar/80 px-3 py-2">
            <Link href="/interview" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Leave interview">
              <ArrowLeft />
            </Link>
            <span className="rounded-md bg-brand-violet/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-violet">Mock · {interview.level}</span>
            <h1 className="min-w-0 truncate text-[15px] font-semibold tracking-tight">{problem.title}</h1>
            {saved.twisted && <span className="rounded-md bg-status-warn/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-status-warn">Twist: {interview.twist.title}</span>}
            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn("flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 font-mono text-[13px] tabular-nums", remaining < 5 * 60000 && "border-status-crit/50 text-status-crit")}
                aria-label="Time remaining"
              >
                <Clock className="size-3.5" /> {remaining >= 0 ? fmtClock(remaining) : `+${fmtClock(-remaining)}`}
              </span>
              <Button variant="outline" size="sm" onClick={() => ctx.run()}>
                <Play /> Run
              </Button>
              <Button size="sm" onClick={() => void finish()}>
                <CheckCircle2 /> Finish interview
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
