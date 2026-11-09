"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Copy, Crown, Flame, FlaskConical, Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cloudEnabled } from "@/lib/supabase/client";
import { getLeaderboard, getPublicProfile, getSharedDesign, type LeaderRow, type PublicProfile, type SharedDesign } from "@/lib/supabase/public";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { ROADMAP } from "@/data/roadmap";
import { currentStreak, levelOf, localDay, longestStreak } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { nodeMonthlyCost } from "@/lib/sim";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { MiniArch } from "@/components/challenges/mini-arch";
import { DifficultyPill } from "@/components/challenges/challenge-list";
import { Avatar } from "@/components/auth/user-menu";
import { useAuth } from "@/components/auth/auth-provider";

const ALL = [...CHALLENGES, ...DESIGNS];
const BY_ID = new Map(ALL.map((c) => [c.id, c]));

type Load<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

function useLoad<T>(fn: () => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  useEffect(() => {
    let alive = true;
    fn().then(
      (data) => alive && setState({ status: "ready", data }),
      (e: unknown) => alive && setState({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">{children}</div>;
}

function Gate({ children }: { children: React.ReactNode }) {
  if (!cloudEnabled) return <Notice>Accounts aren&apos;t configured on this deployment yet, so community features are off.</Notice>;
  return <>{children}</>;
}

/* -------------------------------- leaderboard -------------------------------- */

export function LeaderboardView() {
  return (
    <Gate>
      <Leaderboard />
    </Gate>
  );
}

function Leaderboard() {
  const { profile, user } = useAuth();
  const state = useLoad(() => getLeaderboard(100), []);
  if (state.status === "loading") return <Notice><Loader2 className="mx-auto size-4 animate-spin" /></Notice>;
  if (state.status === "error") return <Notice>Couldn&apos;t load the leaderboard: {state.message}</Notice>;
  const rows: LeaderRow[] = state.data;
  if (rows.length === 0) return <Notice>No one is on the board yet. Solve a problem while signed in to claim the top spot.</Notice>;
  const medal = ["text-status-warn", "text-foreground/80", "text-[oklch(0.72_0.12_55)]"];
  return (
    <div className="space-y-4">
      {!user && (
        <p className="rounded-xl border border-border bg-white/[0.02] px-4 py-3 text-[13px] text-muted-foreground">
          <Link href="/login?next=/leaderboard" className="font-medium text-brand-blue hover:underline">
            Sign in
          </Link>{" "}
          to appear here. Your guest progress comes with you.
        </p>
      )}
      <ol className="surface divide-y divide-border overflow-hidden rounded-2xl">
        {rows.map((r, i) => {
          const me = profile?.username === r.username;
          return (
            <li key={r.username}>
              <Link href={`/u/${r.username}`} className={cn("flex items-center gap-4 px-5 py-3 transition-colors hover:bg-white/[0.03]", me && "bg-brand-blue/[0.07]")}>
                <span className={cn("w-7 text-right font-mono text-[13px] font-semibold", i < 3 ? medal[i] : "text-muted-foreground")}>
                  {i < 3 ? <Crown className="ml-auto size-4" aria-label={`Rank ${i + 1}`} /> : i + 1}
                </span>
                <Avatar name={r.display_name || r.username} url={r.avatar_url} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {r.display_name || r.username} {me && <span className="ml-1 rounded bg-brand-blue/15 px-1.5 font-mono text-[10.5px] text-brand-blue">you</span>}
                  </p>
                  <p className="truncate font-mono text-[11.5px] text-muted-foreground">@{r.username} · level {levelOf(r.xp).level}</p>
                </div>
                <div className="hidden text-right font-mono text-[12px] text-muted-foreground sm:block">
                  {r.solved} solved
                  <br />
                  {r.active_days} active days
                </div>
                <div className="w-24 text-right">
                  <p className="font-mono text-[16px] font-semibold tabular-nums">{r.xp.toLocaleString("en-US")}</p>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">XP</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* --------------------------------- profiles --------------------------------- */

export function ProfileView({ username }: { username: string }) {
  return (
    <Gate>
      <Profile username={username} />
    </Gate>
  );
}

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The last 14 days, one chip per day: was this person active, and where does today's streak stand. */
function StreakStrip({ days }: { days: string[] }) {
  const active = new Set(days);
  const today = new Date();
  const list = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: localDay(d), date: d, on: active.has(localDay(d)), isToday: i === 13 };
  });
  return (
    <ol className="grid grid-cols-7 gap-1.5 sm:grid-cols-14" aria-label="Last 14 days">
      {list.map((d) => (
        <li
          key={d.key}
          title={`${d.date.toDateString()}${d.on ? " · active" : ""}`}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-center",
            d.on ? "border-status-warn/40 bg-status-warn/10" : "border-border bg-white/[0.02]",
            d.isToday && "ring-2 ring-primary/60",
          )}
        >
          <span className="font-mono text-[10px] uppercase text-muted-foreground">{WEEKDAY[(d.date.getDay() + 6) % 7].slice(0, 2)}</span>
          <span className="text-[14px] font-semibold tabular-nums">{d.date.getDate()}</span>
          <Flame className={cn("size-3.5", d.on ? "text-status-warn" : "text-muted-foreground/25")} aria-label={d.on ? "Active" : "Not active"} />
        </li>
      ))}
    </ol>
  );
}

/** Last 26 weeks as a grid (one column per week, Monday at the top), with month and weekday labels. */
function Heatmap({ days }: { days: string[] }) {
  const active = new Set(days);
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - (7 * 25 + ((today.getDay() + 6) % 7)));
  const weeks = Array.from({ length: 26 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      return { key: localDay(dt), date: dt, on: active.has(localDay(dt)), future: dt > today };
    }),
  );
  const months = weeks.map((col, i) => {
    const first = col[0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    return !prev || prev.getMonth() !== first.getMonth() ? first.toLocaleDateString(undefined, { month: "short" }) : "";
  });
  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="grid w-max grid-cols-[2rem_auto] gap-x-2 gap-y-1">
        <span />
        <div className="grid grid-cols-[repeat(26,0.875rem)] gap-1">
          {months.map((m, i) => (
            <span key={i} className="overflow-visible whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              {m}
            </span>
          ))}
        </div>
        <div className="grid grid-rows-[repeat(7,0.875rem)] gap-1 font-mono text-[10px] leading-none text-muted-foreground">
          {WEEKDAY.map((d, i) => (
            <span key={d} className="flex items-center">
              {i % 2 === 0 ? d : ""}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-cols-[repeat(26,0.875rem)] grid-rows-[repeat(7,0.875rem)] gap-1" role="img" aria-label={`${days.length} active days`}>
          {weeks.flat().map((c) => (
            <span
              key={c.key}
              title={c.future ? undefined : `${c.date.toDateString()}${c.on ? " · active" : ""}`}
              className={cn("size-3.5 rounded-[3px]", c.future ? "bg-transparent" : c.on ? "bg-brand-blue" : "bg-white/[0.06]")}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-white/[0.06]" /> no activity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-brand-blue" /> active day
        </span>
      </div>
    </div>
  );
}

function Profile({ username }: { username: string }) {
  const state = useLoad(() => getPublicProfile(username), [username]);
  if (state.status === "loading") return <Notice><Loader2 className="mx-auto size-4 animate-spin" /></Notice>;
  if (state.status === "error") return <Notice>Couldn&apos;t load this profile: {state.message}</Notice>;
  const p: PublicProfile | null = state.data;
  if (!p) return <Notice>No public profile called @{username}. It may be private or the username may have changed.</Notice>;

  const { level, into, toNext } = levelOf(p.xp);
  const solved = new Set(p.solved_ids);
  const streak = currentStreak(p.days, new Date());
  const best = longestStreak(p.days);
  const done = ALL.filter((c) => solved.has(c.id));
  const byDiff = (["Easy", "Medium", "Hard"] as const).map((d) => ({
    d,
    total: ALL.filter((c) => c.difficulty === d).length,
    got: done.filter((c) => c.difficulty === d).length,
  }));
  const DIFF_BAR = { Easy: "bg-status-ok", Medium: "bg-status-warn", Hard: "bg-status-crit" } as const;
  const tiles = [
    { icon: Flame, label: "Current streak", value: `${streak}`, unit: streak === 1 ? "day" : "days", tone: "text-status-warn" },
    { icon: CalendarDays, label: "Longest streak", value: `${best}`, unit: best === 1 ? "day" : "days", tone: "text-brand-cyan" },
    { icon: Sparkles, label: "Total XP", value: p.xp.toLocaleString("en-US"), unit: `level ${level}`, tone: "text-brand-violet" },
    { icon: Trophy, label: "Solved", value: `${p.solved}`, unit: `of ${ALL.length}`, tone: "text-status-ok" },
  ];

  return (
    <div className="space-y-5">
      {/* Identity */}
      <header className="surface relative overflow-hidden rounded-3xl">
        <div className="h-24 bg-brand-blue/15" aria-hidden="true">
          <div className="bg-dots h-full opacity-60" />
        </div>
        <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
          <Avatar name={p.display_name || p.username} url={p.avatar_url} className="-mt-10 size-20 border-4 border-card text-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{p.display_name || p.username}</h1>
            <p className="text-[13px] text-muted-foreground">
              <span className="font-mono">@{p.username}</span> · joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="w-full max-w-56 space-y-1.5">
            <div className="flex justify-between font-mono text-[11.5px]">
              <span className="font-semibold">Level {level}</span>
              <span className="text-muted-foreground">{toNext} XP to {level + 1}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-brand-blue" style={{ width: `${(into / (into + toNext)) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Stats">
        {tiles.map((t) => (
          <div key={t.label} className="surface rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <t.icon className={cn("size-3.5", t.tone)} aria-hidden="true" /> {t.label}
            </p>
            <p className="mt-1.5 text-[26px] font-semibold tracking-tight tabular-nums">
              {t.value} <span className="text-[13px] font-normal text-muted-foreground">{t.unit}</span>
            </p>
          </div>
        ))}
      </section>

      {/* Streak, day by day */}
      <section className="surface space-y-4 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Flame className="size-4 text-status-warn" aria-hidden="true" /> {streak > 0 ? `${streak}-day streak` : "No active streak"}
          </h2>
          <span className="font-mono text-[11.5px] text-muted-foreground">
            longest {best} {best === 1 ? "day" : "days"} · {p.active_days} active days in total
          </span>
        </div>
        <StreakStrip days={p.days} />
        <Heatmap days={p.days} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Completed */}
        <section className="surface space-y-4 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Completed problems</h2>
            <span className="font-mono text-[11.5px] text-muted-foreground">
              {done.length} / {ALL.length}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {byDiff.map((x) => (
              <div key={x.d} className="space-y-1.5 rounded-xl border border-border p-2.5">
                <p className="flex flex-col gap-0.5 text-[12px] sm:flex-row sm:justify-between">
                  <span className="text-muted-foreground">{x.d}</span>
                  <span className="font-mono">
                    {x.got}/{x.total}
                  </span>
                </p>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div className={cn("h-full rounded-full", DIFF_BAR[x.d])} style={{ width: `${x.total ? (x.got / x.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          {done.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">Nothing completed yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {done.map((c) => (
                <li key={c.id}>
                  <Link href={`${c.mode === "build" ? "/build" : "/challenges"}/${c.id}`} className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] transition-colors hover:bg-white/[0.03]">
                    <CheckCircle2 className="size-4 shrink-0 text-status-ok" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                    <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{c.mode === "build" ? c.category : "Challenge"}</span>
                    <DifficultyPill difficulty={c.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Path */}
        <section className="surface space-y-4 rounded-2xl p-5">
          <h2 className="text-[15px] font-semibold">Learning path</h2>
          <ul className="space-y-3.5">
            {ROADMAP.map((st, i) => {
              const n = st.problems.filter((id) => solved.has(id)).length;
              return (
                <li key={st.id} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[13px]">
                    <span className="flex size-5 items-center justify-center rounded-full font-mono text-[10px] font-bold text-background" style={{ background: st.color }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 font-medium">{st.title}</span>
                    <span className="font-mono text-[11.5px] text-muted-foreground">
                      {n}/{st.problems.length}
                    </span>
                  </div>
                  <div className="flex gap-0.5">
                    {st.problems.map((id) => (
                      <span key={id} className="h-1.5 flex-1 rounded-full" title={BY_ID.get(id)?.title} style={{ background: solved.has(id) ? st.color : "oklch(1 0 0 / 7%)" }} />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------ shared designs ------------------------------ */

export function SharedDesignView({ id }: { id: string }) {
  return (
    <Gate>
      <Shared id={id} />
    </Gate>
  );
}

function Shared({ id }: { id: string }) {
  const state = useLoad(() => getSharedDesign(id), [id]);
  if (state.status === "loading") return <Notice><Loader2 className="mx-auto size-4 animate-spin" /></Notice>;
  if (state.status === "error") return <Notice>Couldn&apos;t load this design: {state.message}</Notice>;
  const d: SharedDesign | null = state.data;
  if (!d) return <Notice>This shared design doesn&apos;t exist or was deleted.</Notice>;
  const problem = d.challenge_id ? BY_ID.get(d.challenge_id) : undefined;
  const nodes = d.design.graph.nodes.length;
  const cost = d.design.graph.nodes.reduce((sum, n) => sum + nodeMonthlyCost(n), 0);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">Shared design{problem && ` · ${problem.title}`}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {d.owner && (
              <Link href={`/u/${d.owner.username}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Avatar name={d.owner.display_name || d.owner.username} url={d.owner.avatar_url} className="size-5 text-[9px]" />@{d.owner.username}
              </Link>
            )}
            · {fmtDate(d.created_at)} · {nodes} components · ${Math.round(cost).toLocaleString("en-US")}/month
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              toast.success("Link copied.");
            }}
          >
            <Copy /> Copy link
          </Button>
          <Link href={`/lab?shared=${encodeURIComponent(d.id)}`} className={buttonVariants()}>
            <FlaskConical /> Open a copy in the Lab <ArrowRight />
          </Link>
        </div>
      </header>
      <div className="surface overflow-hidden rounded-2xl">
        <MiniArch graph={d.design.graph} positions={d.design.positions} labels className="h-[420px] bg-black/20" />
      </div>
      {d.design.requirements && (d.design.requirements.functional.length > 0 || d.design.requirements.nonFunctional.length > 0) && (
        <section className="grid gap-4 md:grid-cols-2">
          {(["functional", "nonFunctional"] as const).map((k) => (
            <div key={k} className="surface space-y-2 rounded-2xl p-5">
              <h2 className="text-[14px] font-semibold">{k === "functional" ? "Functional requirements" : "Non-functional requirements"}</h2>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                {d.design.requirements![k].map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
