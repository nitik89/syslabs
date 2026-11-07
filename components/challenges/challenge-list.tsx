"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import { getRepo, type ProgressState } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DIFF_TONE: Record<Challenge["difficulty"], string> = {
  Easy: "text-status-ok border-status-ok/30",
  Medium: "text-status-warn border-status-warn/30",
  Hard: "text-status-crit border-status-crit/30",
};

export function ChallengeList({ challenges }: { challenges: Challenge[] }) {
  const pathOf = (c: Challenge) => (c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`);
  // null = still loading progress; the cards render immediately either way.
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

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
        <Target className="size-5 text-brand-cyan" aria-hidden="true" />
        <p className="text-sm font-medium">No challenges found</p>
        <p className="text-xs text-muted-foreground">Add JSON files to /data/challenges to create some.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {failed && <p className="text-xs text-destructive">Couldn&apos;t read your progress. Scores are hidden, but challenges still work.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {challenges.map((c) => {
          const rec = progress?.challenges[c.id];
          return (
            <li key={c.id}>
              <Link
                href={pathOf(c)}
                className={cn(
                  "group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 outline-none transition-all",
                  "hover:border-brand-blue/50 hover:shadow-[0_8px_32px_-12px_var(--brand-violet)] focus-visible:ring-2 focus-visible:ring-ring",
                  rec?.passed ? "border-status-ok/30" : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.mode === "build" ? c.category : `#${String(c.order).padStart(2, "0")}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {rec?.passed && (
                      <Badge className="bg-status-ok/15 text-status-ok">
                        <CheckCircle2 /> Passed
                      </Badge>
                    )}
                    <Badge variant="outline" className={DIFF_TONE[c.difficulty]}>
                      {c.difficulty}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-semibold tracking-tight">{c.title}</h2>
                  <p className="text-sm text-muted-foreground">{c.summary}</p>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="text-muted-foreground">
                    {c.mode === "build" ? `${c.requirements?.functional.length ?? 0} requirements` : `${c.objectives.length} objectives`} ·{" "}
                    {progress === null ? (
                      <span className="inline-block h-3 w-16 animate-pulse rounded bg-secondary align-middle" aria-label="Loading score" />
                    ) : rec ? (
                      <>
                        best <span className="font-mono text-foreground">{rec.bestScore}</span>
                      </>
                    ) : (
                      "not attempted"
                    )}
                  </span>
                  <span className="flex items-center gap-1 font-medium text-brand-blue">
                    {rec ? "Continue" : "Start"} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
