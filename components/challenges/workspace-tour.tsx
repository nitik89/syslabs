"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddDemo, CacheDemo, ConnectDemo, EditDemo, ReplicasDemo } from "./tour-demos";
import type { DemoCommand } from "@/components/lab/designer";

/** Ask the designer to open or close the components drawer, or run a guided-solve command on the canvas. */
function designerAction(action: Step["action"]) {
  if (!action) return;
  if (typeof action === "string") window.dispatchEvent(new CustomEvent("syslab:components", { detail: action === "open-components" }));
  else for (const cmd of action) window.dispatchEvent(new CustomEvent<DemoCommand>("syslab:demo", { detail: cmd }));
}

export const TOUR_DONE_KEY = "syslab:tour-done";
/** The problem the guided solve runs on. */
export const SOLVE_PROBLEM = "overloaded-database";

export interface Step {
  /** data-tour value of the element to spotlight, or "node:<id>" for a component on the canvas. */
  target: string;
  title: string;
  body: string;
  /** A concrete example, shown highlighted. */
  example?: string;
  /** A looping animation of the gesture. */
  demo?: () => React.ReactNode;
  /** Something to do when the step opens: open/close the components drawer, or build on the canvas. */
  action?: "open-components" | "close-components" | DemoCommand[];
  /** Tone of the example box: a result that's still failing, or one that passes. */
  outcome?: "fail" | "pass";
}

export const TOUR_STEPS: Step[] = [
  {
    target: "problem",
    title: "Start with the problem",
    body: "Read what the system must do, the load it must take (requests per second, read share), the latency and cost limits, and the test cases your design has to pass.",
    action: "close-components",
  },
  {
    target: "articles-tab",
    title: "New to an idea? Read first",
    body: "Articles links the Learn lessons this problem uses, each with a diagram and a worked example. Hints get more specific as you reveal them.",
  },
  {
    target: "add-component",
    title: "Open the component list",
    body: "Every building block lives behind Add component: load balancers, app servers, caches, databases, queues, CDNs and real services like Redis or Kafka.",
  },
  {
    target: "components-drawer",
    title: "Add a component: click or drag",
    body: "Click a component to drop it in the middle of the canvas, or drag it to exactly where you want it. Search by name to find one fast.",
    example: "Type “redis”, then click Redis Cache.",
    demo: AddDemo,
    action: "open-components",
  },
  {
    target: "canvas",
    title: "Connect components",
    body: "Each component has a dot on its right (traffic out) and on its left (traffic in). Drag from a right dot to another component's left dot. Traffic flows along the arrow.",
    example: "Drag from Catalog API → Redis Cache, then Redis Cache → SQL Database.",
    demo: ConnectDemo,
    action: "close-components",
  },
  {
    target: "canvas",
    title: "Scale with replicas",
    body: "Double-click a component to open its settings. Replicas are identical copies: capacity multiplies, and losing one no longer takes you down.",
    example: "App Server at 200% busy → set Replicas to 3 → 67% busy.",
    demo: ReplicasDemo,
  },
  {
    target: "canvas",
    title: "Tune caches and databases",
    body: "In the same settings: a bigger cache size holds more popular items (higher hit ratio); databases have read replicas and indexes. Capacity, latency and cost per replica are fixed to real-world numbers.",
    example: "Redis 8 GB → 32 GB lifts the hit ratio; fewer reads reach the database.",
    demo: CacheDemo,
  },
  {
    target: "canvas",
    title: "Move, rename and remove",
    body: "Drag a component to move it; double-click its name to rename it. To remove a component, click it and press Delete (or use Delete in its settings). To remove a connection, double-click the arrow.",
    example: "Made a mistake? ⌘Z / Ctrl+Z undoes it.",
    demo: EditDemo,
  },
  {
    target: "traffic",
    title: "Try different traffic",
    body: "Change reads, writes and spikes to see where your design breaks. Submit always grades against the problem's own traffic.",
    example: "Press Spike ×5, then Run.",
  },
  {
    target: "run",
    title: "Run it",
    body: "Run pushes 60 seconds of traffic through your design. Components turn amber or red when they're overloaded, and the arrows show requests flowing.",
  },
  {
    target: "console",
    title: "Read the results",
    body: "The console shows which tests pass, p50/p95/p99 latency, errors, cost and the busiest component, plus what to fix next.",
  },
  {
    target: "submit",
    title: "Submit",
    body: "Submit grades every test, including two hidden ones (a traffic spike and a cache restart). Pass them all to solve the problem and earn XP.",
    example: "Want to see it done end to end? Choose “Watch a full solve” below.",
  },
];

/**
 * A guided solve of The Overloaded Database, built live on the real canvas: diagnose, add a cache,
 * connect it, run (still failing), make it bigger, run again (passing), then the learner submits.
 */
export const SOLVE_STEPS: Step[] = [
  {
    target: "node:sqlDb-1",
    title: "Diagnose: the database is drowning",
    body: "5,000 reads a second hit Products DB, which handles about 1,000. That's why it's red at ~500% busy and most requests fail. The brief says most reads are for the same popular products: a perfect case for a cache.",
    action: [{ op: "deselect" }],
    outcome: "fail",
    example: "Rule of thumb: many reads of a few hot items → cache them.",
  },
  {
    target: "node:cache-1",
    title: "Add a Redis Cache",
    body: "From Add component, pick Redis Cache. It answers repeated reads from memory in about a millisecond, so they never reach the database.",
    action: [{ op: "add", kind: "cache", at: { x: 700, y: 300 } }],
  },
  {
    target: "node:cache-1",
    title: "Connect the API to the cache",
    body: "Drag from Catalog API's right dot to the cache's left dot. Now the API checks the cache first; only misses still go to the database (that link is already there).",
    action: [{ op: "connect", from: "appServer-1", to: "cache" }],
  },
  {
    target: "console",
    title: "Run it… still failing",
    body: "The default cache is 8 GB: too small to hold enough of the popular products, so too many reads still miss and the database stays overloaded.",
    action: [{ op: "run" }],
    outcome: "fail",
    example: "Read the console: which tests failed, and which component is busiest?",
  },
  {
    target: "node:cache-1",
    title: "Make the cache bigger",
    body: "Double-click the cache to open its settings and raise Cache size from 8 to 32 GB. More hot items fit, so the hit ratio rises and far fewer reads reach the database. It costs a bit more, still within budget.",
    action: [{ op: "config", node: "cache", patch: { cacheSizeGb: 32 } }, { op: "select", node: "cache" }],
  },
  {
    target: "console",
    title: "Run again: green",
    body: "The database drops well under its limit, errors fall below 1% and latency stays under 60 ms. Every visible test passes.",
    action: [{ op: "deselect" }, { op: "run" }],
    outcome: "pass",
  },
  {
    target: "submit",
    title: "Your turn: press Submit",
    body: "Submit also runs the hidden tests: a 30% traffic spike and a cache restart. This design passes both. Press Submit to see it accepted, then try changing the design to beat the score.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(target: string): HTMLElement | null {
  if (target === "center") return null;
  const selector = target.startsWith("node:") ? `.react-flow__node[data-id="${CSS.escape(target.slice(5))}"]` : `[data-tour="${target}"]`;
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
  // The first one that's actually on screen (some targets exist twice, e.g. hidden on phones).
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  }) ?? null;
}

/**
 * A spotlight tour of the problem workspace. Opens on the first visit (or when `open` is set by the Tour
 * button), steps through the key controls, and skips any step whose target isn't visible.
 */
export function WorkspaceTour({
  open,
  onClose,
  steps: STEPS = TOUR_STEPS,
  onWatchSolve,
  doneKey = TOUR_DONE_KEY,
  endLabel = "Start building",
  onEnd,
}: {
  /** localStorage flag set when the tour is finished or skipped. */
  doneKey?: string;
  /** Label of the last step's main button, and what it does (after closing). */
  endLabel?: string;
  onEnd?: () => void;
  open: boolean;
  onClose: () => void;
  steps?: Step[];
  /** Shown on the last general step: start (or go to) the guided solve. */
  onWatchSolve?: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const finish = useCallback(() => {
    designerAction("close-components");
    try {
      localStorage.setItem(doneKey, "1");
    } catch {
      /* private mode: it may show again */
    }
    setI(0);
    onClose();
  }, [onClose, doneKey]);
  const finishThen = (after?: () => void) => {
    finish();
    after?.();
  };

  // Measure the current target, skipping steps that aren't on screen.
  const measure = useCallback(() => {
    let k = i;
    // "center" steps have no target: a welcome card in the middle of the screen.
    if (STEPS[k].target === "center") return setRect(null);
    let el = findTarget(STEPS[k].target);
    while (!el && k < STEPS.length - 1 && STEPS[k + 1].target !== "center") el = findTarget(STEPS[++k].target);
    if (!el) return k !== i ? setI(k) : setRect(null);
    if (k !== i) return setI(k);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [i, STEPS]);

  useLayoutEffect(() => {
    if (!open) return;
    designerAction(STEPS[i]?.action);
    // Give the drawer a frame to open or close before measuring.
    const id = requestAnimationFrame(() => requestAnimationFrame(measure));
    return () => cancelAnimationFrame(id);
  }, [open, measure, i, STEPS]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((x) => Math.min(STEPS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, measure, finish, STEPS]);

  if (!open) return null;
  const step = STEPS[Math.min(i, STEPS.length - 1)];
  const last = i === STEPS.length - 1;
  const pad = 6;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(360, vw - 24);
  // Place the card beside the target where there's room: right, then left, then below/above.
  // No target (welcome steps): centre the card.
  let cardStyle: React.CSSProperties = { left: Math.max(12, (vw - cardW) / 2), top: Math.max(12, vh / 2 - 180), width: cardW };
  if (rect) {
    const spaceRight = vw - (rect.left + rect.width);
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceRight > cardW + 24) cardStyle = { left: rect.left + rect.width + 16, top: Math.min(Math.max(12, rect.top), vh - 420), width: cardW };
    else if (rect.left > cardW + 24) cardStyle = { left: rect.left - cardW - 16, top: Math.min(Math.max(12, rect.top), vh - 420), width: cardW };
    else if (spaceBelow > 420) cardStyle = { left: Math.min(Math.max(12, rect.left), vw - cardW - 12), top: rect.top + rect.height + 12, width: cardW };
    else cardStyle = { left: Math.min(Math.max(12, rect.left), vw - cardW - 12), top: Math.max(12, rect.top - 420), width: cardW };
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {/* Dim everything except the spotlighted control. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand-blue transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px color-mix(in oklch, var(--shade) 62%, transparent)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <button type="button" aria-label="Close tour" className="absolute inset-0 cursor-default" onClick={finish} tabIndex={-1} />
      <div className="surface absolute space-y-3 rounded-2xl p-4 shadow-2xl transition-all duration-300" style={cardStyle}>
        <div className="flex items-start gap-2">
          <h2 id="tour-title" className="flex-1 text-[15px] font-semibold">
            <span className="mr-1.5 font-mono text-[12px] text-brand-blue">
              {i + 1}/{STEPS.length}
            </span>
            {step.title}
          </h2>
          <Button variant="ghost" size="icon-xs" onClick={finish} aria-label="Skip tour">
            <X />
          </Button>
        </div>
        {step.demo && <step.demo />}
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>
        {step.example && (
          <p
            className={`rounded-lg border px-3 py-2 text-[12.5px] leading-relaxed ${
              step.outcome === "fail"
                ? "border-status-crit/30 bg-status-crit/[0.07]"
                : step.outcome === "pass"
                  ? "border-status-ok/30 bg-status-ok/[0.07]"
                  : "border-brand-blue/25 bg-brand-blue/[0.07]"
            }`}
          >
            <span className={`font-semibold ${step.outcome === "fail" ? "text-status-crit" : step.outcome === "pass" ? "text-status-ok" : "text-brand-blue"}`}>
              {step.outcome === "fail" ? "Why: " : step.outcome === "pass" ? "Result: " : "Example: "}
            </span>
            {step.example}
          </p>
        )}
        {last && onWatchSolve && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => finishThen(onWatchSolve)}>
            Watch a full solve, step by step
          </Button>
        )}
        <div className="flex items-center gap-2">
          <span className="flex flex-1 gap-1" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
            {STEPS.map((s, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-brand-blue" : "w-1.5 bg-white/20"}`} />
            ))}
          </span>
          {i > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setI(i - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button size="sm" onClick={() => (last ? finishThen(onEnd) : setI(i + 1))} autoFocus>
            {last ? endLabel : "Next"} {!last && <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  );
}
