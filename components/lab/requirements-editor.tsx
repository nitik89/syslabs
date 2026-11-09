"use client";

import { useId, useState } from "react";
import { CopyPlus, ListChecks, Plus, Target, X } from "lucide-react";
import type { DesignRequirements } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Key = keyof DesignRequirements;

/** One-click starters for the qualities interviewers always ask about. */
const NFR_STARTERS = [
  "Handles 10k requests/s at peak",
  "p99 latency under 200 ms",
  "99.9% availability (no single point of failure)",
  "No data loss once a write is acknowledged",
  "Eventual consistency is fine for reads",
  "Cost under $3,000 / month",
];
const FR_STARTERS = ["Users can sign up and log in", "Users can create and view items", "Users get notified about updates", "Users can search"];

const SECTIONS: Array<{ key: Key; title: string; blurb: string; placeholder: string; starters: string[]; icon: typeof ListChecks; tone: string }> = [
  {
    key: "functional",
    title: "Functional",
    blurb: "What the system does: features users see.",
    placeholder: "e.g. Users can post a photo",
    starters: FR_STARTERS,
    icon: ListChecks,
    tone: "text-brand-blue bg-brand-blue/10 ring-brand-blue/20",
  },
  {
    key: "nonFunctional",
    title: "Non-functional",
    blurb: "How well it does it: scale, latency, availability, cost.",
    placeholder: "e.g. p99 latency under 200 ms",
    starters: NFR_STARTERS,
    icon: Target,
    tone: "text-brand-cyan bg-brand-cyan/10 ring-brand-cyan/20",
  },
];

function Section({
  section,
  items,
  onChange,
}: {
  section: (typeof SECTIONS)[number];
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();
  const add = (text: string) => {
    const t = text.trim();
    if (!t || items.some((i) => i.toLowerCase() === t.toLowerCase())) return;
    onChange([...items, t.slice(0, 160)]);
  };
  const unused = section.starters.filter((s) => !items.includes(s));
  const Icon = section.icon;

  return (
    <section className="space-y-2.5" aria-labelledby={`${inputId}-h`}>
      <div className="flex items-start gap-2.5">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset", section.tone)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${inputId}-h`} className="flex items-center gap-1.5 text-[13px] font-semibold">
            {section.title}
            <span className="rounded bg-white/[0.06] px-1.5 font-mono text-[10px] font-normal text-muted-foreground">{items.length}</span>
          </h3>
          <p className="text-[11px] text-muted-foreground">{section.blurb}</p>
        </div>
      </div>

      {items.length > 0 && (
        <ol className="space-y-1">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="group flex items-start gap-2 rounded-lg bg-white/[0.03] py-1.5 pl-2.5 pr-1 ring-1 ring-inset ring-border">
              <span className="mt-px font-mono text-[10px] text-muted-foreground">{i + 1}.</span>
              <textarea
                rows={1}
                aria-label={`${section.title} requirement ${i + 1}`}
                defaultValue={item}
                maxLength={160}
                onBlur={(e) => {
                  const t = e.currentTarget.value.trim();
                  if (!t) onChange(items.filter((_, j) => j !== i));
                  else if (t !== item) onChange(items.map((x, j) => (j === i ? t : x)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
                className="field-sizing-content min-w-0 flex-1 resize-none bg-transparent text-[12.5px] leading-snug outline-none"
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Remove "${item}"`}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft("");
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Add a {section.title.toLowerCase()} requirement
        </label>
        <input
          id={inputId}
          value={draft}
          maxLength={160}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={section.placeholder}
          className="h-8 min-w-0 flex-1 rounded-lg bg-white/[0.03] px-2.5 text-[12.5px] outline-none ring-1 ring-inset ring-border placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" size="icon-sm" variant="secondary" aria-label={`Add ${section.title.toLowerCase()} requirement`} disabled={!draft.trim()}>
          <Plus />
        </Button>
      </form>

      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Suggestions">
          {unused.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10.5px] text-muted-foreground transition-colors hover:border-solid hover:text-foreground"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** Write down functional and non-functional requirements next to the design. Saved with it. */
export function RequirementsEditor({
  value,
  onChange,
  brief,
}: {
  value: DesignRequirements;
  onChange: (next: DesignRequirements) => void;
  /** The problem's own requirements (build problems), shown read-only with a copy action. */
  brief?: DesignRequirements;
}) {
  const copyBrief = () => {
    if (!brief) return;
    const merge = (a: string[], b: string[]) => [...a, ...b.filter((x) => !a.includes(x))];
    onChange({ functional: merge(value.functional, brief.functional), nonFunctional: merge(value.nonFunctional, brief.nonFunctional) });
  };

  return (
    <div className="space-y-5">
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        Start like an interview: pin down what the system must do and how well, then design to meet it. Saved with your design.
      </p>
      {brief && (
        <div className="space-y-2 rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">From the brief</p>
            <Button size="xs" variant="ghost" onClick={copyBrief}>
              <CopyPlus /> Copy to mine
            </Button>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {brief.functional.length} functional · {brief.nonFunctional.length} non-functional
          </p>
        </div>
      )}
      {SECTIONS.map((s) => (
        <Section key={s.key} section={s} items={value[s.key]} onChange={(items) => onChange({ ...value, [s.key]: items })} />
      ))}
    </div>
  );
}
