"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Zap } from "lucide-react";
import { INTERVIEWS } from "@/data/interviews";
import { getDesign } from "@/data/designs";
import { getRepo, type InterviewResult } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DifficultyPill } from "@/components/challenges/challenge-list";

const LEVEL_TONE: Record<string, string> = { E4: "bg-status-ok/12 text-status-ok", E5: "bg-status-warn/12 text-status-warn", E6: "bg-status-crit/12 text-status-crit" };

export function InterviewList() {
  const [history, setHistory] = useState<InterviewResult[] | null>(null);
  useEffect(() => {
    getRepo()
      .listInterviews()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);
  const best = (id: string) => history?.filter((h) => h.interviewId === id).reduce<InterviewResult | null>((b, h) => (!b || h.total > b.total ? h : b), null);

  return (
    <div className="space-y-8">
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {INTERVIEWS.map((iv) => {
          const p = getDesign(iv.problem)!;
          const b = best(iv.id);
          return (
            <li key={iv.id}>
              <Link href={`/interview/${iv.id}`} className="surface surface-hover flex h-full flex-col gap-3 rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold", LEVEL_TONE[iv.level])}>Target {iv.level}</span>
                  <DifficultyPill difficulty={p.difficulty} />
                </div>
                <h2 className="text-[16px] font-semibold tracking-tight">Design {p.title}</h2>
                <p className="line-clamp-2 text-[12.5px] text-muted-foreground">{p.summary}</p>
                <div className="mt-auto space-y-1.5 border-t border-border pt-3 font-mono text-[11px] text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <Clock className="size-3" aria-hidden="true" /> {iv.minutes} minutes
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Zap className="size-3" aria-hidden="true" /> a twist at minute 30
                  </p>
                  <p className="flex items-center justify-between">
                    <span>{b ? `best ${b.total} · ${b.level}` : "not attempted"}</span>
                    <ArrowRight className="size-3.5 text-brand-blue" aria-hidden="true" />
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">Your history</h2>
        {!history ? null : history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">No mock interviews yet. Pick one above; the clock starts when you&apos;re ready.</p>
        ) : (
          <ol className="surface divide-y divide-border overflow-hidden rounded-2xl">
            {history.map((h) => {
              const iv = INTERVIEWS.find((i) => i.id === h.interviewId);
              const p = iv ? getDesign(iv.problem) : undefined;
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-4 px-5 py-3 text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-medium">{p ? `Design ${p.title}` : h.interviewId}</span>
                  <span className="hidden gap-3 font-mono text-[11px] text-muted-foreground md:flex">
                    {h.parts.map((x) => (
                      <span key={x.id}>
                        {x.id} {x.score}
                      </span>
                    ))}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">{fmtDate(h.at)}</span>
                  <span className="w-10 text-right font-mono text-[15px] font-semibold">{h.total}</span>
                  <span className={cn("w-16 rounded-md px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold", h.level === "Not yet" ? "bg-white/[0.06] text-muted-foreground" : LEVEL_TONE[h.level])}>
                    {h.level}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
