"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CheckCircle2, Copy, Crown, FlaskConical, Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cloudEnabled } from "@/lib/supabase/client";
import { getLeaderboard, getPublicProfile, getSharedDesign, type LeaderRow, type PublicProfile, type SharedDesign } from "@/lib/supabase/public";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { ROADMAP } from "@/data/roadmap";
import { levelOf } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
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

function Profile({ username }: { username: string }) {
  const state = useLoad(() => getPublicProfile(username), [username]);
  if (state.status === "loading") return <Notice><Loader2 className="mx-auto size-4 animate-spin" /></Notice>;
  if (state.status === "error") return <Notice>Couldn&apos;t load this profile: {state.message}</Notice>;
  const p: PublicProfile | null = state.data;
  if (!p) return <Notice>No public profile called @{username}. It may be private or the username may have changed.</Notice>;
  const { level } = levelOf(p.xp);
  const solved = new Set(p.solved_ids);
  const stats = [
    { icon: Sparkles, label: "XP", value: p.xp.toLocaleString("en-US"), sub: `level ${level}` },
    { icon: Trophy, label: "Solved", value: String(p.solved), sub: `of ${ALL.length}` },
    { icon: CalendarDays, label: "Active days", value: String(p.active_days), sub: `since ${new Date(p.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` },
  ];
  return (
    <div className="space-y-6">
      <header className="surface flex flex-wrap items-center gap-5 rounded-2xl p-6">
        <Avatar name={p.display_name || p.username} url={p.avatar_url} className="size-16 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{p.display_name || p.username}</h1>
          <p className="font-mono text-[13px] text-muted-foreground">@{p.username}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border px-4 py-2.5 text-center">
              <p className="font-mono text-[18px] font-semibold tabular-nums">{s.value}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{s.label}</p>
              <p className="text-[10.5px] text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="surface space-y-4 rounded-2xl p-6">
        <h2 className="text-[15px] font-semibold">Learning path</h2>
        <ul className="space-y-2.5">
          {ROADMAP.map((st) => {
            const n = st.problems.filter((id) => solved.has(id)).length;
            return (
              <li key={st.id} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-[13px]">
                <span className="truncate">{st.title}</span>
                <span className="flex gap-1">
                  {st.problems.map((id) => (
                    <span key={id} className="h-2.5 flex-1 rounded" title={BY_ID.get(id)?.title} style={{ background: solved.has(id) ? st.color : "oklch(1 0 0 / 7%)" }} />
                  ))}
                </span>
                <span className="text-right font-mono text-[12px] text-muted-foreground">
                  {n}/{st.problems.length}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold">Solved problems</h2>
        {p.solved_ids.length === 0 ? (
          <Notice>Nothing solved yet.</Notice>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {p.solved_ids
              .map((id) => BY_ID.get(id))
              .filter((c): c is NonNullable<typeof c> => Boolean(c))
              .map((c) => (
                <li key={c.id}>
                  <Link href={`${c.mode === "build" ? "/build" : "/challenges"}/${c.id}`} className="surface surface-hover flex items-center gap-3 rounded-xl px-4 py-3 text-[13.5px]">
                    <CheckCircle2 className="size-4 shrink-0 text-status-ok" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
                    <DifficultyPill difficulty={c.difficulty} />
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>
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
  const cost = d.design.graph.nodes.reduce((sum, n) => sum + n.config.costPerReplica * n.config.replicas, 0);
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
