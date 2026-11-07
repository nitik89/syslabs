"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Target } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import { getRepo, type ProgressState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { MiniArch } from "./mini-arch";

export const DIFF_TONE: Record<Challenge["difficulty"], string> = {
  Easy: "text-status-ok bg-status-ok/10 ring-status-ok/25",
  Medium: "text-status-warn bg-status-warn/10 ring-status-warn/25",
  Hard: "text-status-crit bg-status-crit/10 ring-status-crit/25",
};

export function DifficultyPill({ difficulty }: { difficulty: Challenge["difficulty"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", DIFF_TONE[difficulty])}>{difficulty}</span>;
}

const PREVIEW_TINT: Record<Challenge["difficulty"], string> = {
  Easy: "from-status-ok/[0.07]",
  Medium: "from-status-warn/[0.07]",
  Hard: "from-status-crit/[0.08]",
};

type Filter = "All" | Challenge["difficulty"] | "Unsolved" | "Solved";

/** Loads progress once; null while loading. */
export function useProgress(): { progress: ProgressState | null; failed: boolean } {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getRepo()
      .getProgress()
      .then(
        (p) => !cancelled && setProgress(p),
        () => !cancelled && setFailed(true),
      );
    return () => {
      cancelled = true;
    };
  }, []);
  return { progress, failed };
}

export function ProgressSummary({ challenges, noun }: { challenges: Challenge[]; noun: string }) {
  const { progress } = useProgress();
  const solved = progress ? challenges.filter((c) => progress.challenges[c.id]?.passed).length : 0;
  const pct = Math.round((solved / Math.max(1, challenges.length)) * 100);
  return (
    <div className="w-full space-y-2 sm:w-64" aria-label={`${solved} of ${challenges.length} ${noun} solved`}>
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Your progress</span>
        <span>
          <span className="font-mono text-sm font-semibold text-foreground">{progress ? solved : "–"}</span> / {challenges.length} solved
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ChallengeList({ challenges, filters = false }: { challenges: Challenge[]; filters?: boolean }) {
  const pathOf = (c: Challenge) => (c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`);
  const { progress, failed } = useProgress();
  const [filter, setFilter] = useState<Filter>("All");

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
        <Target className="size-5 text-brand-cyan" aria-hidden="true" />
        <p className="text-sm font-medium">No challenges found</p>
        <p className="text-xs text-muted-foreground">Add JSON files to /data/challenges to create some.</p>
      </div>
    );
  }

  const shown = challenges.filter((c) => {
    const solved = !!progress?.challenges[c.id]?.passed;
    if (filter === "All") return true;
    if (filter === "Solved") return solved;
    if (filter === "Unsolved") return !solved;
    return c.difficulty === filter;
  });
  const options: Filter[] = ["All", ...(["Easy", "Medium", "Hard"] as const).filter((d) => challenges.some((c) => c.difficulty === d)), "Unsolved", "Solved"];

  return (
    <div className="space-y-5">
      {failed && <p className="text-xs text-destructive">Couldn&apos;t read your progress. Scores are hidden, but challenges still work.</p>}
      {filters && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={filter === o}
              onClick={() => setFilter(o)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                filter === o ? "bg-foreground text-background ring-transparent" : "text-muted-foreground ring-border hover:text-foreground hover:ring-white/20",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const rec = progress?.challenges[c.id];
          return (
            <li key={c.id}>
              <Link
                href={pathOf(c)}
                className={cn(
                  "surface surface-hover group flex h-full flex-col overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  rec?.passed && "border-status-ok/25",
                )}
              >
                <div className={cn("border-b border-border bg-gradient-to-br to-transparent to-70%", PREVIEW_TINT[c.difficulty])}>
                  <MiniArch graph={c.startingDesign.graph} positions={c.startingDesign.positions} className="h-[104px]" />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4 pt-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {c.mode === "build" ? c.category : `#${String(c.order).padStart(2, "0")}`}
                    </span>
                    {rec?.passed ? (
                      <span className="flex items-center gap-1 rounded-full bg-status-ok/12 px-2 py-0.5 text-[11px] font-medium text-status-ok">
                        <CheckCircle2 className="size-3" aria-hidden="true" /> Solved · {rec.bestScore}
                      </span>
                    ) : rec ? (
                      <span className="font-mono text-[11px] text-muted-foreground">best {rec.bestScore}</span>
                    ) : null}
                  </div>
                  <h2 className="text-[15px] font-semibold tracking-tight">{c.title}</h2>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{c.summary}</p>
                  <div className="mt-auto flex items-center justify-between pt-2 text-[11.5px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <DifficultyPill difficulty={c.difficulty} />
                      {c.mode === "build" ? `${c.requirements?.functional.length ?? 0} requirements` : `${c.objectives.length} objectives`}
                    </span>
                    <span className="flex items-center gap-0.5 font-medium text-brand-blue opacity-80 transition-opacity group-hover:opacity-100">
                      {progress === null ? "Open" : rec?.passed ? "Review" : rec ? "Continue" : "Start"}
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
