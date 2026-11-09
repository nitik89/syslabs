"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CheckCircle2, Layers } from "lucide-react";
import { FLASHCARDS } from "@/data/flashcards";
import { dailyProblem, problemPath } from "@/lib/daily";
import { dueCards, getRepo, localDay, type ProgressState } from "@/lib/storage";
import { DifficultyPill } from "@/components/challenges/challenge-list";

/** Two small daily habits: today's shared problem and the flashcards due. */
export function DailyRow({ progress, today }: { progress: ProgressState; today: Date }) {
  const daily = dailyProblem(today);
  const solved = progress.challenges[daily.id]?.passed;
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => {
    getRepo()
      .getCards()
      .then((c) => {
        const { due, fresh } = dueCards(
          FLASHCARDS.map((x) => x.id),
          c,
          localDay(today),
        );
        setDue(due.length + fresh.length);
      })
      .catch(() => setDue(null));
  }, [today]);

  return (
    <section className="grid gap-3 md:grid-cols-[1.6fr_1fr]" aria-label="Today">
      <Link href={problemPath(daily)} className="surface surface-hover flex min-w-0 items-center gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-blue/12 text-brand-blue ring-1 ring-inset ring-brand-blue/25">
          <CalendarCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
            Today&apos;s problem · {today.toLocaleDateString(undefined, { weekday: "long" })}
          </p>
          <p className="truncate text-[15px] font-semibold tracking-tight">{daily.title}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">{daily.summary}</p>
        </div>
        <DifficultyPill difficulty={daily.difficulty} />
        {solved ? (
          <span className="flex items-center gap-1 text-[12px] font-medium text-status-ok">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Done
          </span>
        ) : (
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
      </Link>
      <Link href="/review" className="surface surface-hover flex min-w-0 items-center gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-violet/12 text-brand-violet ring-1 ring-inset ring-brand-violet/25">
          <Layers className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-violet">Flashcards</p>
          <p className="text-[15px] font-semibold tracking-tight">{due === null ? "Review" : due === 0 ? "All caught up" : `${due} cards due`}</p>
          <p className="truncate text-[12.5px] text-muted-foreground">A few minutes of spaced recall</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
