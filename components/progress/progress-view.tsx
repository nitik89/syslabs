"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, CalendarDays, CheckCircle2, Flame, FolderOpen, Sparkles, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { CHALLENGES, getChallenge, problemPath } from "@/data/challenges";
import { DESIGNS, getDesign } from "@/data/designs";
import type { Challenge } from "@/lib/challenges/types";
import { ScoreChart, DifficultyChart } from "./progress-charts";
import { currentStreak, getRepo, longestStreak, type SavedDesign } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BackupPanel } from "./backup-panel";
import { ActivityGrid, EmptyBlock, ErrorBlock, LoadingBlock, StatTile } from "./bits";
import { useProgressData } from "./use-progress";

export function ProgressView() {
  const { data, reload } = useProgressData();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [track, setTrack] = useState<"challenges" | "build">("challenges");

  if (data.status === "loading") return <LoadingBlock label="Loading your progress…" />;
  if (data.status === "error") return <ErrorBlock message={data.message} onRetry={reload} />;

  const { progress, designs, today } = data;
  const passed = [...CHALLENGES, ...DESIGNS].filter((c) => progress.challenges[c.id]?.passed).length;
  const total = CHALLENGES.length + DESIGNS.length;
  const list: Challenge[] = track === "challenges" ? CHALLENGES : DESIGNS;
  const streak = currentStreak(progress.activeDays, today);
  const best = longestStreak(progress.activeDays);
  const hasAnything = progress.xp > 0 || progress.activeDays.length > 0 || designs.length > 0 || Object.keys(progress.challenges).length > 0;

  const deleteDesign = async (d: SavedDesign) => {
    try {
      await getRepo().deleteDesign(d.id);
      toast.success(`Deleted "${d.name}"`);
      setConfirmDelete(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    }
  };

  const resetProgress = async () => {
    try {
      await getRepo().resetProgress();
      toast.success("Progress reset");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset.");
    }
  };

  if (!hasAnything) {
    return (
      <div className="space-y-6">
        <EmptyBlock
          icon={Sparkles}
          title="No progress yet"
          body="Run a simulation in the Lab or attempt a challenge. XP, streaks, scores and saved designs will show up here, all stored in this browser."
        >
          <Link href="/challenges" className={buttonVariants({ size: "sm" })}>
            Browse challenges
          </Link>
          <Link href="/lab" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open the Lab
          </Link>
        </EmptyBlock>
        <BackupPanel onImported={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Sparkles} label="Total XP" value={progress.xp.toLocaleString()} sub="1 per score point, +50 on first pass" accent="bg-brand-violet/15 text-brand-violet" />
        <StatTile icon={Flame} label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} sub={streak > 0 ? "Keep it going today" : "Run a simulation to start one"} accent="bg-status-warn/15 text-status-warn" />
        <StatTile icon={CalendarDays} label="Longest streak" value={`${best} day${best === 1 ? "" : "s"}`} sub={`${progress.activeDays.length} active day${progress.activeDays.length === 1 ? "" : "s"} total`} accent="bg-brand-cyan/15 text-brand-cyan" />
        <StatTile icon={Trophy} label="Problems solved" value={`${passed} / ${total}`} sub={passed === total ? "All cleared" : "Challenges and products"} accent="bg-status-ok/15 text-status-ok" />
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="surface space-y-1 rounded-2xl p-5 lg:col-span-3">
          <h2 className="text-sm font-semibold">Best scores</h2>
          <p className="text-xs text-muted-foreground">Every problem you&apos;ve attempted. Green means solved.</p>
          <ScoreChart progress={progress} />
        </section>
        <section className="surface space-y-1 rounded-2xl p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Solved by difficulty</h2>
          <p className="text-xs text-muted-foreground">Challenges and build problems together.</p>
          <DifficultyChart progress={progress} />
        </section>
      </div>

      <section className="surface space-y-3 rounded-2xl p-5">
        <h2 className="text-sm font-semibold">Activity</h2>
        <ActivityGrid activeDays={progress.activeDays} today={today} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Scores</h2>
          <div className="flex rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-inset ring-border" role="group" aria-label="Track">
            {(["challenges", "build"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={track === t}
                onClick={() => setTrack(t)}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  track === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "challenges" ? `Challenges (${CHALLENGES.length})` : `Build (${DESIGNS.length})`}
              </button>
            ))}
          </div>
        </div>
        <ul className="surface divide-y divide-border overflow-hidden rounded-2xl">
          {list.map((c) => {
            const rec = progress.challenges[c.id];
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    {rec?.passed ? (
                      <Badge className="bg-status-ok/15 text-status-ok">
                        <CheckCircle2 /> Solved
                      </Badge>
                    ) : rec ? (
                      <Badge variant="outline" className="text-status-warn">
                        Attempted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not started
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {rec ? `${rec.attempts} attempt${rec.attempts === 1 ? "" : "s"} · last ${fmtDate(rec.lastAttemptAt)}` : c.summary}
                  </p>
                </div>
                <div className="flex w-40 items-center gap-2" aria-label={rec ? `Best score ${rec.bestScore} of 100` : "No score yet"}>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    {rec && (
                      <div
                        className={cn("h-full rounded-full", rec.bestScore >= 80 ? "bg-status-ok" : rec.bestScore >= 50 ? "bg-status-warn" : "bg-status-crit")}
                        style={{ width: `${rec.bestScore}%` }}
                      />
                    )}
                  </div>
                  <span className="w-8 text-right font-mono text-xs">{rec ? rec.bestScore : "–"}</span>
                </div>
                <Link href={problemPath(c)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {rec ? "Improve" : "Start"}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Saved designs ({designs.length})</h2>
        {designs.length === 0 ? (
          <EmptyBlock icon={FolderOpen} title="No saved designs" body="Use Save in the Lab or in a challenge to keep a design here." />
        ) : (
          <ul className="surface divide-y divide-border overflow-hidden rounded-2xl">
            {designs.map((d) => {
              const ch = d.challengeId ? (getChallenge(d.challengeId) ?? getDesign(d.challengeId)) : undefined;
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {ch ? `${ch.mode === "build" ? "Build" : "Challenge"}: ${ch.title}` : "Lab"} · {d.graph.nodes.length} components · updated {fmtDate(d.updatedAt)}
                    </p>
                  </div>
                  {confirmDelete === d.id ? (
                    <>
                      <Button size="sm" variant="destructive" onClick={() => void deleteDesign(d)}>
                        Confirm delete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => setConfirmDelete(d.id)}>
                        <Trash2 />
                      </Button>
                      {ch ? (
                        <Link href={`${problemPath(ch)}?design=${encodeURIComponent(d.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Open in challenge
                        </Link>
                      ) : (
                        <Link href={`/lab?design=${encodeURIComponent(d.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Open in Lab
                        </Link>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <BackupPanel onImported={reload} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-5">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Award className="size-4 text-muted-foreground" aria-hidden="true" /> Start over
          </h2>
          <p className="text-xs text-muted-foreground">Clears XP, streak and challenge scores. Saved designs are kept.</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button variant="destructive" size="sm" />}>Reset progress</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset all progress?</DialogTitle>
              <DialogDescription>XP, streaks and best scores will be permanently erased from this browser. This can&apos;t be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="destructive" onClick={() => void resetProgress()} />}>Reset progress</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
