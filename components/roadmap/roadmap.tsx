"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Flag } from "lucide-react";
import { ROADMAP, type Stage } from "@/data/roadmap";
import { LESSONS } from "@/data/lessons";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import type { Challenge } from "@/lib/challenges/types";
import type { ProgressState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { DifficultyPill } from "@/components/challenges/challenge-list";
import { ErrorBlock, LoadingBlock } from "@/components/progress/bits";
import { useProgressData } from "@/components/progress/use-progress";

const BY_ID = new Map<string, Challenge>([...CHALLENGES, ...DESIGNS].map((c) => [c.id, c]));
const problemsOf = (s: Stage) => s.problems.map((id) => BY_ID.get(id)!).filter(Boolean);
const pathOf = (c: Challenge) => (c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`);
const TOTAL = ROADMAP.reduce((n, s) => n + s.problems.length, 0);

function stageStats(s: Stage, progress: ProgressState | null) {
  const solved = s.problems.filter((id) => progress?.challenges[id]?.passed).length;
  return { solved, total: s.problems.length, done: solved === s.problems.length };
}

/** Problem numbers per stage ("problems 1–4"). */
function ranges(): Array<[number, number]> {
  let start = 1;
  return ROADMAP.map((s) => {
    const r: [number, number] = [start, start + s.problems.length - 1];
    start += s.problems.length;
    return r;
  });
}

/** The colour bar plus one column per stage. Each segment fills as you solve its problems. */
export function RoadmapStrip({ progress, compact }: { progress: ProgressState | null; compact?: boolean }) {
  const lessonsOf = (id: string) => LESSONS.filter((l) => l.stage === id).length;
  const all = ROADMAP.flatMap((x) => x.problems);
  const overall = all.filter((id) => progress?.challenges[id]?.passed).length / all.length;
  return (
    <div className="relative overflow-x-auto pb-1">
      <ol className={cn("relative grid min-w-[720px] grid-cols-6", compact ? "gap-3" : "gap-4")} aria-label="Learning path stages">
        {/* The track: a line through every station that fills as you solve problems. */}
        <div className="pointer-events-none absolute left-[8.33%] right-[8.33%] top-[22px] h-[3px] rounded-full bg-white/[0.08]" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-blue transition-[width] duration-700" style={{ width: `${overall * 100}%` }} />
        </div>
        {ROADMAP.map((s, i) => {
          const { solved, total, done } = stageStats(s, progress);
          const pct = solved / total;
          return (
            <li key={s.id} className="relative flex flex-col items-center text-center">
              {/* Station: a ring that fills with the stage's progress. */}
              <div
                className="relative z-10 flex size-11 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(${s.color} ${pct * 360}deg, color-mix(in oklch, var(--ink) 10%, transparent) 0deg)` }}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-card font-mono text-[13px] font-bold" style={{ color: s.color }}>
                  {done ? <CheckCircle2 className="size-4" aria-label="Stage complete" /> : i + 1}
                </span>
              </div>
              <p className="mt-2.5 text-[13.5px] font-semibold tracking-tight">{s.title}</p>
              <p className="font-mono text-[10.5px] text-muted-foreground">
                {lessonsOf(s.id) > 0 && `${lessonsOf(s.id)} lesson${lessonsOf(s.id) === 1 ? "" : "s"} · `}
                {solved}/{total} solved
              </p>
              {!compact && (
                <p className="mt-1.5 max-w-[16ch] text-[11.5px] leading-snug text-muted-foreground">{s.tags.slice(0, 3).join(" · ")}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Dashboard section: the strip with a link to the full roadmap. */
export function RoadmapSection({ progress }: { progress: ProgressState }) {
  const solved = ROADMAP.flatMap((s) => s.problems).filter((id) => progress.challenges[id]?.passed).length;
  return (
    <section className="surface space-y-5 rounded-2xl p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">Learning path</p>
          <h2 className="text-xl font-semibold tracking-tight">Learn it by breaking it, one stage at a time</h2>
          <p className="text-[13px] text-muted-foreground">
            {LESSONS.length} lessons and {TOTAL} problems across {ROADMAP.length} stages · {solved} solved
          </p>
        </div>
        <Link href="/roadmap" className="flex items-center gap-1 text-[13px] font-medium text-brand-blue hover:underline">
          Open roadmap <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <RoadmapStrip progress={progress} compact />
    </section>
  );
}

/** Full page: the strip, then every stage with its problems and checkpoint. */
export function RoadmapView() {
  const { data, reload } = useProgressData();
  if (data.status === "loading") return <LoadingBlock label="Loading roadmap…" />;
  if (data.status === "error") return <ErrorBlock message={data.message} onRetry={reload} />;
  const { progress } = data;
  const nextId = ROADMAP.flatMap((s) => s.problems).find((id) => !progress.challenges[id]?.passed);
  const r = ranges();

  return (
    <div className="space-y-10">
      <RoadmapStrip progress={progress} />
      <div className="space-y-6">
        {ROADMAP.map((s, i) => {
          const items = problemsOf(s);
          const { solved, total, done } = stageStats(s, progress);
          return (
            <section key={s.id} className="surface overflow-hidden rounded-2xl" aria-labelledby={`stage-${s.id}`}>
              <div className="flex flex-wrap items-start gap-4 border-b border-border p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold text-background" style={{ background: s.color }}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em]" style={{ color: s.color }}>
                    Stage {i + 1} · problems {r[i][0]}–{r[i][1]}
                  </p>
                  <h2 id={`stage-${s.id}`} className="text-lg font-semibold tracking-tight">
                    {s.title}
                  </h2>
                  <p className="text-[13px] text-muted-foreground">{s.blurb}</p>
                </div>
                <div className="w-full space-y-1.5 sm:w-40 sm:text-right">
                  <p className={cn("font-mono text-[12px]", done ? "text-status-ok" : "text-muted-foreground")}>
                    {done ? "Stage complete" : `${solved} / ${total} solved`}
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full" style={{ width: `${(solved / total) * 100}%`, background: s.color }} />
                  </div>
                </div>
              </div>
              {LESSONS.some((l) => l.stage === s.id) && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white/[0.015] px-5 py-3">
                  <span className="mr-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">Learn first</span>
                  {LESSONS.filter((l) => l.stage === s.id).map((l) => (
                    <Link
                      key={l.id}
                      href={`/learn/${l.id}`}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[12.5px] transition-colors hover:border-primary/50 hover:bg-white/[0.03]"
                    >
                      <BookOpen className="size-3.5" style={{ color: s.color }} aria-hidden="true" />
                      {l.title}
                    </Link>
                  ))}
                </div>
              )}
              <ol className="divide-y divide-border">
                {items.map((c, j) => {
                  const rec = progress.challenges[c.id];
                  const checkpoint = j === items.length - 1;
                  const isNext = c.id === nextId;
                  return (
                    <li key={c.id}>
                      <Link
                        href={pathOf(c)}
                        className={cn(
                          "flex items-center gap-3 px-5 py-3 text-[13.5px] outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04]",
                          isNext && "bg-brand-blue/[0.06]",
                        )}
                      >
                        <span className="w-6 font-mono text-[11px] text-muted-foreground">{r[i][0] + j}</span>
                        {rec?.passed ? (
                          <CheckCircle2 className="size-4 shrink-0 text-status-ok" aria-label="Solved" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Not solved" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{c.mode === "build" ? "Build" : "Challenge"}</span>
                        {checkpoint && (
                          <span className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold" style={{ color: s.color, background: `color-mix(in oklch, ${s.color} 14%, transparent)` }}>
                            <Flag className="size-3" aria-hidden="true" /> Checkpoint
                          </span>
                        )}
                        {isNext && <span className="rounded-md bg-brand-blue/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-blue">Up next</span>}
                        {rec && !rec.passed && <span className="font-mono text-[11px] text-muted-foreground">best {rec.bestScore}</span>}
                        <DifficultyPill difficulty={c.difficulty} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
