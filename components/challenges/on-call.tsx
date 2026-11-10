"use client";

import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { shuffledOptions, type Incident } from "@/data/challenges/incidents";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** "You are on call": the page you got, then name the root cause before fixing. */
export function OnCallCard({
  id,
  incident,
  intro,
  onClose,
}: {
  id: string;
  incident: Incident;
  intro: string;
  onClose: () => void;
}) {
  const [options, correct] = shuffledOptions(id, incident);
  const [choice, setChoice] = useState<number | null>(null);
  const answered = choice !== null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-4">
      <section
        aria-label="On-call page"
        className="pointer-events-auto w-full max-w-xl space-y-3 rounded-2xl border border-status-crit/40 bg-popover/95 p-4 shadow-[0_24px_60px_-20px_var(--shadow)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-status-crit">
            <span className="size-2 animate-pulse rounded-full bg-status-crit" aria-hidden="true" /> You are on call
          </p>
          <button type="button" onClick={onClose} className="text-[11.5px] text-muted-foreground hover:text-foreground hover:underline">
            Look at the system first
          </button>
        </div>
        <p className="rounded-lg border border-status-crit/30 bg-status-crit/10 px-3 py-2 font-mono text-[12px] text-status-crit">{incident.page}</p>
        <p className="text-[13px] leading-relaxed">{intro}</p>
        <p className="text-[11.5px] text-muted-foreground">
          The canvas, charts and logs below show the system as it is right now. Investigate, then name the root cause.
        </p>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold">What is the root cause?</legend>
          {options.map((o, i) => {
            const isRight = i === correct;
            const picked = choice === i;
            return (
              <button
                key={o}
                type="button"
                disabled={answered}
                onClick={() => setChoice(i)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-left text-[12.5px] transition-colors enabled:hover:border-primary/50 enabled:hover:bg-white/[0.04]",
                  answered && isRight && "border-status-ok/50 bg-status-ok/10",
                  answered && picked && !isRight && "border-status-crit/50 bg-status-crit/10",
                  answered && !isRight && !picked && "opacity-55",
                )}
              >
                {answered && isRight && <Check className="mt-0.5 size-3.5 shrink-0 text-status-ok" aria-label="Correct answer" />}
                {answered && picked && !isRight && <X className="mt-0.5 size-3.5 shrink-0 text-status-crit" aria-label="Your answer" />}
                {o}
              </button>
            );
          })}
        </fieldset>
        {answered && (
          <div className="space-y-2.5" role="status">
            <p className={cn("text-[12.5px] font-semibold", choice === correct ? "text-status-ok" : "text-status-crit")}>
              {choice === correct ? "Correct diagnosis." : "Not quite."}
            </p>
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">{incident.why}</p>
            <Button size="sm" onClick={onClose}>
              Start fixing <ArrowRight />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
