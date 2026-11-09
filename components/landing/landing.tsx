"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, BookOpen, Boxes, EyeOff, FlaskConical, Layers, PenTool, Play, Send, Share2, Trophy } from "lucide-react";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { LESSONS } from "@/data/lessons";
import { FLASHCARDS } from "@/data/flashcards";
import { NODE_KINDS } from "@/lib/sim";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { MiniArch } from "@/components/challenges/mini-arch";
import { RoadmapStrip } from "@/components/roadmap/roadmap";
import { LogoMark } from "@/components/shell/logo";
import { useAuth } from "@/components/auth/auth-provider";
import { HeroScene, type HeroPhase } from "./hero-scene";

const PROBLEMS = CHALLENGES.length + DESIGNS.length;
const demo = CHALLENGES[0];

const STEPS = [
  { icon: BookOpen, title: "Read the brief", body: "Functional and non-functional requirements, traffic and a budget." },
  { icon: PenTool, title: "Design on a canvas", body: `Drag from ${NODE_KINDS.length}+ building blocks and real services, then connect them.` },
  { icon: Play, title: "Run real traffic", body: "Replay 60 seconds of load: p50/p95/p99, errors, cost and the busiest component." },
  { icon: Send, title: "Submit", body: "Visible tests plus hidden ones: a viral spike and a cache restart." },
];

const FEATURES = [
  { icon: Activity, title: "On-call incidents", body: "Get paged, diagnose the root cause, then fix the system before the next spike." },
  { icon: EyeOff, title: "Hidden tests", body: "Designs tuned to one traffic profile fail. Leave headroom like production." },
  { icon: Boxes, title: "Real components", body: "Kafka, DynamoDB, Redis, CloudFront, Claude, Kubernetes, gateways and more." },
  { icon: Layers, title: "Flashcards", body: "Spaced repetition from every lesson, a few minutes a day." },
  { icon: Trophy, title: "Streaks and leaderboard", body: "Daily problem, XP, levels and a public profile." },
  { icon: Share2, title: "Share designs", body: "Send a link; anyone can open a copy in their own Lab." },
];

const FAQ = [
  { q: "Is it free?", a: "Yes. Every problem, lesson and the simulator are free. You don't even need an account: progress is saved in your browser until you sign in." },
  { q: "How realistic is the simulator?", a: "It's a deterministic model: capacity, queueing, cache hit ratios, replicas, locks and failures. It's built for learning trade-offs, not for benchmarking real hardware." },
  { q: "Who is it for?", a: "Engineers preparing for system-design interviews, and anyone who wants to understand why systems fall over and how to fix them." },
];

const PREVIEW: Record<HeroPhase, { tag: string; title: string; verdict: string; check: string; stats: [string, string, boolean][] }> = {
  broken: {
    tag: "Paged",
    title: "Database at 500% capacity",
    verdict: "FAIL",
    check: "error rate ≤ 1% · got 80%",
    stats: [
      ["p50", "5.0 s", false],
      ["p99", "5.0 s", false],
      ["errors", "80.0%", false],
      ["Products DB", "500% busy", false],
    ],
  },
  fixed: {
    tag: "Resolved",
    title: "Cache added, reads off the database",
    verdict: "PASS",
    check: "error rate ≤ 1% · got 0.2%",
    stats: [
      ["p50", "9 ms", true],
      ["p99", "41 ms", true],
      ["errors", "0.2%", true],
      ["Products DB", "62% busy", true],
    ],
  },
};

function HeroPreview() {
  const [phase, setPhase] = useState<HeroPhase>("broken");
  const p = PREVIEW[phase];
  const ok = phase === "fixed";
  return (
    <div className="surface relative overflow-hidden rounded-3xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-[10.5px] font-semibold transition-colors",
            ok ? "bg-status-ok/15 text-status-ok" : "bg-status-crit/15 text-status-crit",
          )}
        >
          {p.tag}
        </span>
        <span className="truncate text-[13px] font-semibold" aria-live="polite">
          {p.title}
        </span>
        <span className="ml-auto hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">{demo.title}</span>
      </div>
      <HeroScene
        onPhase={setPhase}
        className="h-64 bg-[radial-gradient(ellipse_at_50%_40%,oklch(0.25_0.03_250/0.5),transparent_70%)] sm:h-72"
        fallback={<MiniArch graph={demo.startingDesign.graph} positions={demo.startingDesign.positions} labels className="h-full bg-black/20" />}
      />
      <div className="space-y-3 border-t border-border p-4">
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold">Peak traffic</span>
          <span className={cn("rounded px-1.5 font-mono text-[10px] font-bold", ok ? "bg-status-ok/15 text-status-ok" : "bg-status-crit/15 text-status-crit")}>{p.verdict}</span>
          <span className={cn("rounded px-1.5 py-0.5 font-mono text-[10.5px]", ok ? "bg-status-ok/10 text-status-ok" : "bg-status-crit/10 text-status-crit")}>{p.check}</span>
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]">
          {p.stats.map(([l, v, good], i) => (
            <span key={l}>
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{l}</span>{" "}
              <span className={cn("font-semibold", i === 0 ? "text-foreground" : good ? "text-status-ok" : "text-status-crit")}>{v}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Shown at / to first-time visitors who aren't signed in. */
export function Landing() {
  const { enabled, user } = useAuth();
  return (
    <div className="space-y-24 pb-16">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-white/[0.03] px-3 py-1 text-[12px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-status-ok" aria-hidden="true" /> {PROBLEMS} problems · {LESSONS.length} lessons · free
          </p>
          <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.03em] md:text-5xl">
            Design systems. <span className="text-brand-blue">Break them.</span> Learn why.
          </h1>
          <p className="max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            SysLab is a hands-on simulator for system design. Draw an architecture, push real traffic through it, watch it fail, and fix it until every test passes, including the hidden ones.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/challenges/${demo.id}`} className={buttonVariants({ size: "lg" })}>
              Start the first problem <ArrowRight />
            </Link>
            <Link href="/lab" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <FlaskConical /> Open the Lab
            </Link>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            No sign-up needed.{" "}
            {enabled && !user && (
              <>
                <Link href="/login" className="text-brand-blue hover:underline">
                  Create an account
                </Link>{" "}
                to sync progress and join the leaderboard.
              </>
            )}
          </p>
        </div>

        {/* Product preview: a live 3D run. The database melts down, a cache lands, traffic recovers. */}
        <HeroPreview />
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">How it works</p>
          <h2 className="text-2xl font-semibold tracking-tight">From a blank canvas to a passing design</h2>
        </div>
        <ol className="grid gap-3 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="surface space-y-2.5 rounded-2xl p-5">
              <span className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue/12 text-brand-blue">
                  <s.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">0{i + 1}</span>
              </span>
              <h3 className="text-[15px] font-semibold">{s.title}</h3>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Path */}
      <section className="surface space-y-6 rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">Learning path</p>
            <h2 className="text-2xl font-semibold tracking-tight">Six stages, each ending in a checkpoint</h2>
          </div>
          <Link href="/roadmap" className="flex items-center gap-1 text-[13px] font-medium text-brand-blue hover:underline">
            See the roadmap <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <RoadmapStrip progress={null} />
      </section>

      {/* Features */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-blue">What&apos;s inside</p>
          <h2 className="text-2xl font-semibold tracking-tight">Practice, theory and revision in one place</h2>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="surface flex gap-3 rounded-2xl p-5">
              <f.icon className="mt-0.5 size-5 shrink-0 text-brand-blue" aria-hidden="true" />
              <div>
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [PROBLEMS, "graded problems"],
            [LESSONS.length, "concept lessons"],
            [FLASHCARDS.length, "flashcards"],
            [`${NODE_KINDS.length}+`, "components"],
          ].map(([v, l]) => (
            <div key={String(l)} className="rounded-2xl border border-border p-4 text-center">
              <dd className="text-3xl font-semibold tracking-tight">{v}</dd>
              <dt className="text-[12px] text-muted-foreground">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* FAQ */}
      <section className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <h2 className="text-2xl font-semibold tracking-tight">Questions</h2>
        <dl className="divide-y divide-border rounded-2xl border border-border">
          {FAQ.map((f) => (
            <div key={f.q} className="space-y-1 p-5">
              <dt className="text-[15px] font-semibold">{f.q}</dt>
              <dd className="text-[13.5px] leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* CTA + footer */}
      <section className="surface flex flex-col items-center gap-4 rounded-3xl p-10 text-center">
        <LogoMark className="size-10" />
        <h2 className="text-2xl font-semibold tracking-tight">Your first outage is waiting</h2>
        <p className="max-w-md text-[14px] text-muted-foreground">5,000 reads a second are crushing a database that tops out at 1,000. Can you fix it?</p>
        <Link href={`/challenges/${demo.id}`} className={buttonVariants({ size: "lg" })}>
          Take the challenge <ArrowRight />
        </Link>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-[12.5px] text-muted-foreground">
        <span>© 2026 SysLab · All metrics are simulated.</span>
        <nav className="flex gap-4" aria-label="Legal">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
        </nav>
      </footer>
    </div>
  );
}
