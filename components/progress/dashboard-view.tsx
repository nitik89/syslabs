"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowUpRight, Blocks, CheckCircle2, Circle, Flame, FlaskConical, FolderOpen, Sparkles, Target, Trophy } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS, getDesign } from "@/data/designs";
import { currentStreak, levelOf, type ProgressState } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { MiniArch } from "@/components/challenges/mini-arch";
import { DifficultyPill } from "@/components/challenges/challenge-list";
import { ErrorBlock, LoadingBlock } from "./bits";
import { useProgressData } from "./use-progress";

function greeting(d: Date): string {
  const h = d.getHours();
  return h < 5 ? "Burning the midnight oil?" : h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

function Stat({ icon: Icon, label, value, of, tone }: { icon: typeof Flame; label: string; value: string | number; of?: string; tone: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <span className={cn("flex size-7 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-[-0.02em]">
        {value}
        {of && <span className="ml-1 text-sm font-normal text-muted-foreground">{of}</span>}
      </p>
    </div>
  );
}

function Track({
  title,
  blurb,
  href,
  icon: Icon,
  items,
  progress,
  path,
  tone,
}: {
  title: string;
  blurb: string;
  href: string;
  icon: typeof Target;
  items: Challenge[];
  progress: ProgressState;
  path: (c: Challenge) => string;
  tone: string;
}) {
  const solved = items.filter((c) => progress.challenges[c.id]?.passed).length;
  // Show the next few unsolved, falling back to the first ones when everything is solved.
  const upcoming = [...items.filter((c) => !progress.challenges[c.id]?.passed), ...items].slice(0, 3);
  return (
    <section className="surface flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 items-center justify-center rounded-xl ring-1 ring-inset", tone)}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
        <Link href={href} className="flex items-center gap-0.5 text-xs font-medium text-brand-blue hover:underline">
          All <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Progress</span>
          <span className="font-mono">
            {solved} / {items.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet" style={{ width: `${(solved / items.length) * 100}%` }} />
        </div>
      </div>
      <ul className="space-y-1.5">
        {upcoming.map((c) => {
          const rec = progress.challenges[c.id];
          return (
            <li key={c.id}>
              <Link
                href={path(c)}
                className="flex items-center gap-2.5 rounded-xl bg-white/[0.025] px-3 py-2.5 text-[13px] outline-none ring-1 ring-inset ring-transparent transition-colors hover:bg-white/[0.05] hover:ring-border focus-visible:ring-ring"
              >
                {rec?.passed ? (
                  <CheckCircle2 className="size-4 shrink-0 text-status-ok" aria-label="Solved" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-label="Not solved" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                {rec && !rec.passed && <span className="font-mono text-[11px] text-muted-foreground">best {rec.bestScore}</span>}
                <DifficultyPill difficulty={c.difficulty} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DashboardView() {
  const { data, reload } = useProgressData();

  if (data.status === "loading") return <LoadingBlock label="Loading…" />;
  if (data.status === "error") return <ErrorBlock message={data.message} onRetry={reload} />;

  const { progress, designs, today } = data;
  const next = CHALLENGES.find((c) => !progress.challenges[c.id]?.passed) ?? DESIGNS.find((c) => !progress.challenges[c.id]?.passed);
  const nextPath = next ? (next.mode === "build" ? `/build/${next.id}` : `/challenges/${next.id}`) : "/progress";
  const nextRec = next ? progress.challenges[next.id] : undefined;
  const passedCh = CHALLENGES.filter((c) => progress.challenges[c.id]?.passed).length;
  const passedBuild = DESIGNS.filter((c) => progress.challenges[c.id]?.passed).length;
  const streak = currentStreak(progress.activeDays, today);
  const { level } = levelOf(progress.xp);
  const isNew = progress.activeDays.length === 0 && designs.length === 0 && Object.keys(progress.challenges).length === 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">Dashboard</p>
        <h1 className="text-balance text-3xl font-semibold tracking-[-0.02em]">
          {isNew ? "Welcome to SysLab." : greeting(today)} <span className="text-gradient-brand">Ready to break something?</span>
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Design architectures, push real traffic through them, and see exactly where they fail.
        </p>
      </header>

      {/* Continue */}
      <section className="surface relative overflow-hidden rounded-3xl">
        <div className="bg-aurora pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative grid gap-6 p-6 md:grid-cols-[1.1fr_1fr] md:p-7">
          <div className="flex flex-col justify-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-cyan">
              {!next ? "Everything solved" : isNew ? "Start here" : nextRec ? "Continue" : "Up next"}
              {next && ` · ${next.mode === "build" ? next.category : `Challenge ${String(next.order).padStart(2, "0")}`}`}
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.015em]">{next ? next.title : "You've solved every problem"}</h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {next
                ? nextRec
                  ? `Best score so far: ${nextRec.bestScore}. You haven't met every objective yet.`
                  : next.summary
                : "Push your best scores higher, or build something new in the Lab."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href={nextPath} className={cn(buttonVariants({ size: "lg" }), "bg-brand-gradient shadow-brand border-0 hover:opacity-90")}>
                {next ? (nextRec ? "Continue" : "Start") : "View scores"} <ArrowRight />
              </Link>
              <Link href="/lab" className={buttonVariants({ variant: "outline", size: "lg" })}>
                <FlaskConical /> Open Lab
              </Link>
            </div>
          </div>
          {next && (
            <MiniArch
              graph={next.startingDesign.graph}
              positions={next.startingDesign.positions}
              labels
              className="hidden h-48 rounded-2xl border border-border bg-black/25 md:block"
            />
          )}
        </div>
      </section>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Target} label="Challenges solved" value={passedCh} of={`/ ${CHALLENGES.length}`} tone="bg-brand-blue/12 text-brand-blue" />
        <Stat icon={Blocks} label="Products built" value={passedBuild} of={`/ ${DESIGNS.length}`} tone="bg-brand-cyan/12 text-brand-cyan" />
        <Stat icon={Sparkles} label="Total XP" value={progress.xp.toLocaleString()} of={`level ${level}`} tone="bg-brand-violet/12 text-brand-violet" />
        <Stat icon={Flame} label="Streak" value={streak} of={streak === 1 ? "day" : "days"} tone="bg-status-warn/12 text-status-warn" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Track
          title="Fix broken architectures"
          blurb={`${CHALLENGES.length} challenges · find the flaw, fix it, beat the score`}
          href="/challenges"
          icon={Target}
          items={CHALLENGES}
          progress={progress}
          path={(c) => `/challenges/${c.id}`}
          tone="bg-brand-blue/12 text-brand-blue ring-brand-blue/25"
        />
        <Track
          title="Build real products"
          blurb={`${DESIGNS.length} products · shopping, chat, social, payments, AI`}
          href="/build"
          icon={Blocks}
          items={DESIGNS}
          progress={progress}
          path={(c) => `/build/${c.id}`}
          tone="bg-brand-cyan/12 text-brand-cyan ring-brand-cyan/25"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-muted-foreground" aria-hidden="true" /> Recent designs
          </h2>
          {designs.length > 0 && (
            <Link href="/progress" className="text-xs text-brand-blue hover:underline focus-visible:underline focus-visible:outline-none">
              View all
            </Link>
          )}
        </div>
        {designs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            <FolderOpen className="mx-auto mb-2 size-4" aria-hidden="true" />
            Nothing saved yet. Use Save in the Lab or a challenge to keep a design.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {designs.slice(0, 3).map((d) => (
              <li key={d.id}>
                <Link
                  href={
                    d.challengeId
                      ? `${getDesign(d.challengeId) ? `/build/${d.challengeId}` : `/challenges/${d.challengeId}`}?design=${encodeURIComponent(d.id)}`
                      : `/lab?design=${encodeURIComponent(d.id)}`
                  }
                  className="surface surface-hover block overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MiniArch graph={d.graph} positions={d.positions} className="h-20 border-b border-border bg-black/20" />
                  <div className="p-3.5">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {d.graph.nodes.length} components · {fmtDate(d.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
