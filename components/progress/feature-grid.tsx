"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BookMarked, Check, Flame, Library, Map, Search, Trophy, Blocks, type LucideIcon } from "lucide-react";
import { ROADMAP } from "@/data/roadmap";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { currentStreak, levelOf, type ProgressState } from "@/lib/storage";
import { cn } from "@/lib/utils";

const ALL = [...CHALLENGES, ...DESIGNS];
const DIFF_TEXT = { Easy: "text-status-ok", Medium: "text-status-warn", Hard: "text-status-crit" } as const;

function Tile({
  href,
  onClick,
  icon: Icon,
  tone,
  title,
  blurb,
  children,
  className,
}: {
  href?: string;
  onClick?: () => void;
  icon: LucideIcon;
  tone: string;
  title: string;
  blurb: string;
  children: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start gap-3 p-4 pb-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", tone)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{blurb}</p>
        </div>
      </div>
      <div className="mx-4 mb-4 flex flex-1 items-center rounded-xl border border-border bg-black/20 p-4">{children}</div>
    </>
  );
  const cls = cn("surface surface-hover flex flex-col overflow-hidden rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", className);
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/** The toolkit: each tile previews a part of SysLab with your real progress. */
export function FeatureGrid({ progress, today }: { progress: ProgressState; today: Date }) {
  const streak = currentStreak(progress.activeDays, today);
  const ids = ROADMAP.flatMap((s) => s.problems);
  const nextId = ids.find((id) => !progress.challenges[id]?.passed);
  const solved = ids.filter((id) => progress.challenges[id]?.passed).length;
  const bank = (["Easy", "Medium", "Hard", "Hard"] as const).map((d, i) => ALL.filter((c) => c.difficulty === d)[i === 3 ? 1 : 0]).filter(Boolean);
  const { level, into, toNext } = levelOf(progress.xp);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">Your toolkit</p>
        <h2 className="text-xl font-semibold tracking-tight">Practice, simulate, revise and track</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Tile
          href="/roadmap"
          icon={Map}
          tone="bg-brand-blue/12 text-brand-blue ring-brand-blue/25"
          title="Learning path"
          blurb={`${ROADMAP.length} stages, ${ids.length} problems. Each stage ends with a checkpoint.`}
          className="md:col-span-2"
        >
          <div className="w-full space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[11.5px] text-muted-foreground">
              <span>
                {solved} / {ids.length} solved
              </span>
              <span className="flex items-center gap-1 text-status-warn">
                <Flame className="size-3.5" aria-hidden="true" /> {streak}-day streak
              </span>
            </div>
            <ul className="space-y-1.5" aria-label="Progress by stage">
              {ROADMAP.map((st, i) => {
                const n = st.problems.filter((id) => progress.challenges[id]?.passed).length;
                return (
                  <li key={st.id} className="grid grid-cols-[1.25rem_7.5rem_1fr_2.5rem] items-center gap-2 font-mono text-[11px]">
                    <span style={{ color: st.color }}>{i + 1}</span>
                    <span className="truncate text-foreground/85">{st.title}</span>
                    <span className="flex gap-0.5">
                      {st.problems.map((id) => (
                        <span
                          key={id}
                          className="h-2 flex-1 rounded-[3px]"
                          style={{
                            background: progress.challenges[id]?.passed ? st.color : "oklch(1 0 0 / 7%)",
                            boxShadow: id === nextId ? `inset 0 0 0 1.5px ${st.color}` : undefined,
                          }}
                        />
                      ))}
                    </span>
                    <span className="text-right text-muted-foreground">
                      {n}/{st.problems.length}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </Tile>

        <Tile href="/challenges" icon={Library} tone="bg-brand-violet/12 text-brand-violet ring-brand-violet/25" title="Problem bank" blurb={`${ALL.length} problems graded by simulated test cases.`}>
          <ul className="w-full space-y-1.5">
            {bank.map((c) => {
              const rec = progress.challenges[c.id];
              return (
                <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11px]">
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className={DIFF_TEXT[c.difficulty]}>{c.difficulty.toLowerCase()}</span>
                  <span className="w-10 text-right text-muted-foreground">{rec?.passed ? <Check className="ml-auto size-3.5 text-status-ok" aria-label="Solved" /> : rec ? rec.bestScore : "—"}</span>
                </li>
              );
            })}
          </ul>
        </Tile>

        <Tile href="/lab" icon={Activity} tone="bg-status-ok/12 text-status-ok ring-status-ok/25" title="Live simulation" blurb="60 seconds of traffic: p50, p95, p99, errors and logs.">
          <div className="flex w-full items-end justify-center gap-3">
            {[
              ["p50", 34, "var(--brand-cyan)"],
              ["p95", 58, "var(--brand-blue)"],
              ["p99", 82, "var(--status-warn)"],
              ["err", 12, "var(--status-crit)"],
            ].map(([l, h, c]) => (
              <div key={l as string} className="flex flex-col items-center gap-1.5">
                <div className="flex h-20 w-9 items-end overflow-hidden rounded-md bg-white/[0.05]">
                  <div className="w-full rounded-md" style={{ height: `${h}%`, background: c as string }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile
          icon={Search}
          tone="bg-white/[0.06] text-foreground ring-white/10"
          onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }))}
          title="Search everything"
          blurb="Press ⌘K anywhere to jump to a problem or page."
        >
          <div className="w-full space-y-1.5">
            <div className="flex items-center gap-2 rounded-lg border border-primary/60 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[11.5px]">
              <Search className="size-3.5 text-muted-foreground" aria-hidden="true" /> quorum<span className="animate-pulse text-primary">|</span>
            </div>
            {[
              ["The Lock That Lost Quorum", "Challenge"],
              ["Concert Ticket Drop", "Challenge"],
              ["Ride-Hailing", "Build"],
            ].map(([t, k], i) => (
              <div key={t} className={cn("flex justify-between rounded-md px-2.5 py-1 font-mono text-[11px]", i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                <span className="truncate">{t}</span>
                <span>{k}</span>
              </div>
            ))}
          </div>
        </Tile>

        <Tile href="/cheat-sheet" icon={BookMarked} tone="bg-brand-cyan/12 text-brand-cyan ring-brand-cyan/25" title="Cheat sheet" blurb="Latency numbers, nines and formulas on one page.">
          <ul className="w-full space-y-2 font-mono text-[11px]">
            {[
              ["RAM read", "100 ns", 22],
              ["SSD read", "100 µs", 54],
              ["Same-DC round trip", "500 µs", 61],
              ["Cross-continent", "150 ms", 88],
            ].map(([l, v, w]) => (
              <li key={l as string} className="space-y-1">
                <div className="flex justify-between">
                  <span>{l}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${w}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Tile>

        <Tile href="/build" icon={Blocks} tone="bg-status-warn/12 text-status-warn ring-status-warn/25" title="Real products" blurb={`${DESIGNS.length} case studies designed from requirements.`}>
          <ul className="grid w-full grid-cols-2 gap-1.5">
            {DESIGNS.slice(0, 6).map((d) => (
              <li
                key={d.id}
                className={cn(
                  "truncate rounded-md border px-2 py-1 text-center font-mono text-[10.5px]",
                  progress.challenges[d.id]?.passed ? "border-status-ok/40 text-status-ok" : "border-border text-muted-foreground",
                )}
              >
                {d.title}
              </li>
            ))}
          </ul>
        </Tile>

        <Tile href="/progress" icon={Trophy} tone="bg-status-crit/12 text-status-crit ring-status-crit/25" title="Progress & XP" blurb="Scores, streaks and every submission, saved in your browser.">
          <div className="w-full space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-semibold">Level {level}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{progress.xp.toLocaleString("en-US")} XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-brand-blue" style={{ width: `${(into / (into + toNext)) * 100}%` }} />
            </div>
            <p className="font-mono text-[11px] text-muted-foreground">{toNext} XP to level {level + 1}</p>
          </div>
        </Tile>
      </div>
    </section>
  );
}
