"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle2, Flame, FlaskConical, FolderOpen, Sparkles, Target, Trophy } from "lucide-react";
import { CHALLENGES } from "@/data/challenges";
import { currentStreak } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { ErrorBlock, LoadingBlock, StatTile } from "./bits";
import { useProgressData } from "./use-progress";

export function DashboardView() {
  const { data, reload } = useProgressData();

  if (data.status === "loading") return <LoadingBlock label="Loading…" />;
  if (data.status === "error") return <ErrorBlock message={data.message} onRetry={reload} />;

  const { progress, designs, today } = data;
  const next = CHALLENGES.find((c) => !progress.challenges[c.id]?.passed);
  const nextRec = next ? progress.challenges[next.id] : undefined;
  const passed = CHALLENGES.filter((c) => progress.challenges[c.id]?.passed).length;
  const streak = currentStreak(progress.activeDays, today);
  const isNew = progress.activeDays.length === 0 && designs.length === 0 && Object.keys(progress.challenges).length === 0;

  return (
    <div className="space-y-8">
      {/* Primary call to action */}
      <section className="glow-brand relative overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-cyan">{isNew ? "Get started" : next ? "Up next" : "All challenges cleared"}</p>
            <h2 className="text-xl font-semibold tracking-tight">
              {next ? next.title : "You've passed every challenge"}
            </h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {next
                ? nextRec
                  ? `Best score so far: ${nextRec.bestScore}. You haven't met every objective yet.`
                  : next.summary
                : "Push your best scores higher, or build something new in the Lab."}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {next ? (
              <Link href={`/challenges/${next.id}`} className={cn(buttonVariants(), "bg-gradient-to-r from-brand-blue to-brand-violet text-white hover:opacity-90")}>
                {nextRec ? "Continue challenge" : "Start challenge"} <ArrowRight />
              </Link>
            ) : (
              <Link href="/progress" className={buttonVariants()}>
                View scores <ArrowRight />
              </Link>
            )}
            <Link href="/lab" className={buttonVariants({ variant: "outline" })}>
              <FlaskConical /> Open Lab
            </Link>
          </div>
        </div>
      </section>

      {isNew ? (
        <section className="grid gap-4 md:grid-cols-3" aria-label="How SysLab works">
          {[
            { icon: FlaskConical, title: "1. Build", body: "Drag components onto the canvas and wire them together. Tune capacity, replicas and cost." },
            { icon: Target, title: "2. Simulate", body: "A deterministic model pushes traffic through your design and shows load, latency, errors and failure points." },
            { icon: Trophy, title: "3. Improve", body: "Challenges score you on performance, reliability, cost and architecture. Fix it, rerun, and beat your best." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="size-5 text-brand-blue" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </section>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile icon={Sparkles} label="XP" value={progress.xp.toLocaleString()} accent="bg-brand-violet/15 text-brand-violet" />
            <StatTile icon={Flame} label="Streak" value={`${streak} day${streak === 1 ? "" : "s"}`} accent="bg-status-warn/15 text-status-warn" />
            <StatTile icon={CheckCircle2} label="Passed" value={`${passed} / ${CHALLENGES.length}`} accent="bg-status-ok/15 text-status-ok" />
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Recent designs</h2>
              {designs.length > 0 && (
                <Link href="/progress" className="text-xs text-brand-blue hover:underline focus-visible:underline focus-visible:outline-none">
                  View all
                </Link>
              )}
            </div>
            {designs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                <FolderOpen className="mx-auto mb-2 size-4" aria-hidden="true" />
                Nothing saved yet. Use Save in the Lab or a challenge to keep a design.
              </p>
            ) : (
              <ul className="grid gap-3 md:grid-cols-3">
                {designs.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={d.challengeId ? `/challenges/${d.challengeId}` : `/lab?design=${encodeURIComponent(d.id)}`}
                      className="block rounded-2xl border border-border bg-card p-4 outline-none transition-colors hover:border-brand-blue/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.graph.nodes.length} components · {fmtDate(d.updatedAt)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
