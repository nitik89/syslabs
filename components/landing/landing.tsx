"use client";

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

        {/* Product preview */}
        <div className="surface relative overflow-hidden rounded-3xl">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <span className="rounded bg-status-crit/15 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-status-crit">On-call</span>
            <span className="truncate text-[13px] font-semibold">{demo.title}</span>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">t=59s</span>
          </div>
          <MiniArch graph={demo.startingDesign.graph} positions={demo.startingDesign.positions} labels className="h-48 bg-black/20" />
          <div className="space-y-3 border-t border-border p-4">
            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span className="font-semibold">Peak traffic</span>
              <span className="rounded bg-status-crit/15 px-1.5 font-mono text-[10px] font-bold text-status-crit">FAIL</span>
              <span className="rounded bg-status-crit/10 px-1.5 py-0.5 font-mono text-[10.5px] text-status-crit">error rate ≤ 1% · got 80%</span>
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px]">
              {[
                ["p50", "5.0 s", "text-foreground"],
                ["p99", "5.0 s", "text-status-crit"],
                ["errors", "80.0%", "text-status-crit"],
                ["Products DB", "500% busy", "text-status-crit"],
              ].map(([l, v, c]) => (
                <span key={l}>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{l}</span> <span className={cn("font-semibold", c)}>{v}</span>
                </span>
              ))}
            </div>
            <svg viewBox="0 0 300 50" className="h-12 w-full" aria-hidden="true">
              <polyline points="0,46 30,44 60,40 75,8 100,6 140,7 180,5 220,6 260,7 300,6" fill="none" stroke="var(--status-crit)" strokeWidth="2" />
              <polyline points="0,47 60,46 75,30 100,29 140,30 180,28 220,30 260,29 300,30" fill="none" stroke="var(--brand-blue)" strokeWidth="1.5" />
              <line x1="0" x2="300" y1="40" y2="40" stroke="var(--status-ok)" strokeDasharray="4 4" strokeWidth="1" />
            </svg>
          </div>
        </div>
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
