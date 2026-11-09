"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Search, Target } from "lucide-react";
import type { Challenge } from "@/lib/challenges/types";
import { getRepo, type ProgressState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { MiniArch } from "./mini-arch";
import { KindIcon } from "@/components/lab/kind-icon";
import { CATALOG } from "@/lib/sim";

export const DIFF_TONE: Record<Challenge["difficulty"], string> = {
  Easy: "text-status-ok bg-status-ok/10 ring-status-ok/25",
  Medium: "text-status-warn bg-status-warn/10 ring-status-warn/25",
  Hard: "text-status-crit bg-status-crit/10 ring-status-crit/25",
};

export function DifficultyPill({ difficulty }: { difficulty: Challenge["difficulty"] }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", DIFF_TONE[difficulty])}>{difficulty}</span>;
}

const PREVIEW_TINT: Record<Challenge["difficulty"], string> = {
  Easy: "from-status-ok/[0.07]",
  Medium: "from-status-warn/[0.07]",
  Hard: "from-status-crit/[0.08]",
};


/** Loads progress once; null while loading. */
export function useProgress(): { progress: ProgressState | null; failed: boolean } {
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
  return { progress, failed };
}

export function ProgressSummary({ challenges, noun }: { challenges: Challenge[]; noun: string }) {
  const { progress } = useProgress();
  const solved = progress ? challenges.filter((c) => progress.challenges[c.id]?.passed).length : 0;
  const pct = Math.round((solved / Math.max(1, challenges.length)) * 100);
  return (
    <div className="w-full space-y-2 sm:w-64" aria-label={`${solved} of ${challenges.length} ${noun} solved`}>
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>Your progress</span>
        <span>
          <span className="font-mono text-sm font-semibold text-foreground">{progress ? solved : "–"}</span> / {challenges.length} solved
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full bg-brand-blue transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const CATEGORY_COLORS = ["var(--brand-blue)", "var(--brand-cyan)", "var(--brand-violet)", "var(--status-ok)", "var(--status-warn)", "var(--status-crit)"];
/** A stable colour per category name. */
export function categoryColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

/** Build cards: the starting canvas is empty, so preview the brief instead: scale, mix and required building blocks. */
function BuildPreview({ challenge: c }: { challenge: Challenge }) {
  const color = categoryColor(c.category ?? "");
  const kinds = [...new Set(c.objectives.filter((o) => o.metric === "componentLoad").flatMap((o) => o.kinds ?? []))];
  const t = c.traffic;
  const stats = [
    [t.rps >= 1000 ? `${(t.rps / 1000).toFixed(t.rps % 1000 ? 1 : 0)}k` : String(t.rps), "req/s peak"],
    [`${Math.round(t.readRatio * 100)}%`, "reads"],
    [String(c.requirements?.functional.length ?? 0), "features"],
  ];
  return (
    <div className="relative h-[104px] overflow-hidden border-b border-border" style={{ background: `linear-gradient(135deg, color-mix(in oklch, ${color} 14%, transparent), transparent 70%)` }}>
      <div className="bg-dots absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative flex h-full items-center justify-between gap-4 px-4">
        <dl className="flex gap-4">
          {stats.map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-mono text-[17px] font-semibold tabular-nums">{v}</dd>
              <dd className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{l}</dd>
            </div>
          ))}
        </dl>
        {kinds.length > 0 && (
          <ul className="flex -space-x-1.5" aria-label="Required building blocks">
            {kinds.slice(0, 4).map((k) => (
              <li key={k} title={CATALOG[k].label} className="rounded-lg ring-2 ring-card">
                <KindIcon kind={k} size="md" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function ChallengeList({ challenges, filters = false }: { challenges: Challenge[]; filters?: boolean }) {
  const pathOf = (c: Challenge) => (c.mode === "build" ? `/build/${c.id}` : `/challenges/${c.id}`);
  const { progress, failed } = useProgress();
  const [difficulty, setDifficulty] = useState<"All" | Challenge["difficulty"]>("All");
  const [status, setStatus] = useState<"All" | "Unsolved" | "Solved">("All");
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const categories = [...new Set(challenges.map((c) => c.category).filter((x): x is string => Boolean(x)))];

  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center">
        <Target className="size-5 text-brand-cyan" aria-hidden="true" />
        <p className="text-sm font-medium">No challenges found</p>
        <p className="text-xs text-muted-foreground">Add JSON files to /data/challenges to create some.</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = challenges.filter((c) => {
    if (category !== "All" && c.category !== category) return false;
    if (difficulty !== "All" && c.difficulty !== difficulty) return false;
    const solved = !!progress?.challenges[c.id]?.passed;
    if (status === "Solved" && !solved) return false;
    if (status === "Unsolved" && solved) return false;
    return !q || `${c.title} ${c.summary} ${c.category ?? ""}`.toLowerCase().includes(q);
  });
  const difficulties = (["Easy", "Medium", "Hard"] as const).filter((d) => challenges.some((c) => c.difficulty === d));
  const selectCls =
    "h-9 rounded-lg border border-border bg-white/[0.03] px-2.5 text-[13px] outline-none transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-5">
      {failed && <p className="text-xs text-destructive">Couldn&apos;t read your progress. Scores are hidden, but challenges still work.</p>}
      {filters && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter problems">
          <label className="relative min-w-52 flex-1 sm:max-w-xs">
            <span className="sr-only">Search problems</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search problems…"
              className="h-9 w-full rounded-lg border border-border bg-white/[0.03] pl-8 pr-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {categories.length > 1 && (
            <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="All">All categories ({challenges.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c} ({challenges.filter((x) => x.category === c).length})
                </option>
              ))}
            </select>
          )}
          <div className="flex h-9 items-center rounded-lg border border-border bg-white/[0.03] p-0.5" role="radiogroup" aria-label="Difficulty">
            {(["All", ...difficulties] as const).map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "h-full rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                  difficulty === d ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls}>
            <option value="All">Any status</option>
            <option value="Unsolved">Unsolved</option>
            <option value="Solved">Solved</option>
          </select>
          <span className="ml-auto font-mono text-[11.5px] text-muted-foreground">
            {shown.length} of {challenges.length}
          </span>
        </div>
      )}
      {shown.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => {
          const rec = progress?.challenges[c.id];
          return (
            <li key={c.id}>
              <Link
                href={pathOf(c)}
                className={cn(
                  "surface surface-hover group flex h-full flex-col overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  rec?.passed && "border-status-ok/25",
                )}
              >
                {c.mode === "build" ? (
                  <BuildPreview challenge={c} />
                ) : (
                  <div className={cn("border-b border-border bg-gradient-to-br to-transparent to-70%", PREVIEW_TINT[c.difficulty])}>
                    <MiniArch graph={c.startingDesign.graph} positions={c.startingDesign.positions} className="h-[104px]" />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4 pt-3.5">
                  <div className="flex items-center justify-between gap-2">
                    {c.mode === "build" && c.category ? (
                      <span
                        className="rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
                        style={{ color: categoryColor(c.category), background: `color-mix(in oklch, ${categoryColor(c.category)} 14%, transparent)` }}
                      >
                        {c.category}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">#{String(c.order).padStart(2, "0")}</span>
                    )}
                    {rec?.passed ? (
                      <span className="flex items-center gap-1 rounded-full bg-status-ok/12 px-2 py-0.5 text-[11px] font-medium text-status-ok">
                        <CheckCircle2 className="size-3" aria-hidden="true" /> Solved · {rec.bestScore}
                      </span>
                    ) : rec ? (
                      <span className="font-mono text-[11px] text-muted-foreground">best {rec.bestScore}</span>
                    ) : null}
                  </div>
                  <h2 className="text-[15px] font-semibold tracking-tight">{c.title}</h2>
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{c.summary}</p>
                  <div className="mt-auto flex items-center justify-between pt-2 text-[11.5px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <DifficultyPill difficulty={c.difficulty} />
                      {c.requirements ? `${c.requirements.functional.length} functional · ${c.requirements.nonFunctional.length} non-functional` : `${c.objectives.length} objectives`}
                    </span>
                    <span className="flex items-center gap-0.5 font-medium text-brand-blue opacity-80 transition-opacity group-hover:opacity-100">
                      {progress === null ? "Open" : rec?.passed ? "Review" : rec ? "Continue" : "Start"}
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
