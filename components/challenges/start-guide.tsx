"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import type { TestCase } from "@/lib/challenges/test-cases";
import { CATALOG } from "@/lib/sim";
import { TestCaseCard } from "./test-results";

/** Building blocks the requirement checks ask for, by name. */
function requiredBlocks(ch: Challenge): string[] {
  const kinds = ch.objectives.filter((o) => o.metric === "componentLoad").flatMap((o) => o.kinds ?? []);
  return [...new Set(kinds)].map((k) => CATALOG[k].label);
}

/** Over a near-empty canvas on build problems: how to start, what's needed, and the numbers to design for. */
export function StartGuide({ challenge }: { challenge: Challenge }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const blocks = requiredBlocks(challenge);
  const steps = ["Read the requirements", "Add components from the palette", "Connect them from Users outward", "Run, then Submit"];
  return (
    <div className="pointer-events-none absolute bottom-4 left-16 right-4 z-10 flex justify-center">
      <section
        aria-label="How to start"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-popover/90 py-1.5 pl-3 pr-1.5 text-[12px] shadow-[0_12px_32px_-14px_black] backdrop-blur-md"
      >
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded-full bg-white/[0.08] font-mono text-[9.5px] text-foreground">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {blocks.length > 0 && (
          <span className="flex items-center gap-1.5 border-l border-border pl-3 text-muted-foreground">
            Needs
            {blocks.map((b) => (
              <span key={b} className="rounded bg-brand-blue/12 px-1.5 py-px font-mono text-[10.5px] text-brand-blue">
                {b}
              </span>
            ))}
          </span>
        )}
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label="Hide tips"
          className="rounded-md p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </section>
    </div>
  );
}

/** Run console before the first run: the tests your design will face. */
export function TestsPreview({ tests }: { tests: TestCase[] }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[12.5px] text-muted-foreground">
        Press <span className="font-medium text-foreground">Run</span> to push 60 seconds of traffic through your design. These tests are checked on every run; <span className="font-medium text-foreground">Submit</span> records your score.
      </p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {tests.map((t) => (
          <TestCaseCard key={t.id} test={t} />
        ))}
      </div>
    </div>
  );
}
