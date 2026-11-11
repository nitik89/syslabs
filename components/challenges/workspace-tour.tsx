"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TOUR_DONE_KEY = "syslab:tour-done";

interface Step {
  /** data-tour value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "problem",
    title: "1 · Start with the problem",
    body: "Read what the system must do (functional), how well (non-functional: load, latency, cost), and the test cases your design has to pass.",
  },
  {
    target: "articles-tab",
    title: "2 · New to the idea? Read first",
    body: "Articles links the Learn lessons this problem uses, each with a diagram and a worked example. Hints get more specific as you reveal them.",
  },
  {
    target: "add-component",
    title: "3 · Add components",
    body: "Open the list and click a component (a cache, a database, a queue…) to drop it on the canvas. Search by name, like Redis or Kafka.",
  },
  {
    target: "canvas",
    title: "4 · Connect and tune",
    body: "Drag from a component's right dot to another's left dot to send traffic there. Double-click a component to set replicas or cache size. Double-click an arrow to remove it.",
  },
  {
    target: "traffic",
    title: "5 · Try different traffic",
    body: "Change reads, writes and spikes to see where your design breaks. Submit always grades against the problem's own traffic.",
  },
  {
    target: "run",
    title: "6 · Run it",
    body: "Run pushes 60 seconds of traffic through your design. Components turn amber or red when they're overloaded.",
  },
  {
    target: "console",
    title: "7 · Read the results",
    body: "The console shows which tests pass, p50/p95/p99 latency, errors, cost and the busiest component, plus what to fix next.",
  },
  {
    target: "submit",
    title: "8 · Submit",
    body: "Submit grades every test, including two hidden ones (a traffic spike and a cache restart). Pass them all to solve the problem and earn XP.",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(target: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`));
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
export function WorkspaceTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_DONE_KEY, "1");
    } catch {
      /* private mode: it may show again */
    }
    setI(0);
    onClose();
  }, [onClose]);

  // Measure the current target, skipping steps that aren't on screen.
  const measure = useCallback(() => {
    let k = i;
    let el = findTarget(STEPS[k].target);
    while (!el && k < STEPS.length - 1) el = findTarget(STEPS[++k].target);
    if (!el) return setRect(null);
    if (k !== i) return setI(k);
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [i]);

  useLayoutEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [open, measure]);

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
  }, [open, measure, finish]);

  if (!open) return null;
  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const pad = 6;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(340, vw - 24);
  // Place the card beside the target where there's room: right, then left, then below/above.
  let cardStyle: React.CSSProperties = { left: 12, bottom: 12, width: cardW };
  if (rect) {
    const spaceRight = vw - (rect.left + rect.width);
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceRight > cardW + 24) cardStyle = { left: rect.left + rect.width + 16, top: Math.min(Math.max(12, rect.top), vh - 240), width: cardW };
    else if (rect.left > cardW + 24) cardStyle = { left: rect.left - cardW - 16, top: Math.min(Math.max(12, rect.top), vh - 240), width: cardW };
    else if (spaceBelow > 230) cardStyle = { left: Math.min(Math.max(12, rect.left), vw - cardW - 12), top: rect.top + rect.height + 12, width: cardW };
    else cardStyle = { left: Math.min(Math.max(12, rect.left), vw - cardW - 12), top: Math.max(12, rect.top - 230), width: cardW };
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
            {step.title}
          </h2>
          <Button variant="ghost" size="icon-xs" onClick={finish} aria-label="Skip tour">
            <X />
          </Button>
        </div>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>
        <div className="flex items-center gap-2">
          <span className="flex flex-1 gap-1" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
            {STEPS.map((s, k) => (
              <span key={s.target} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-brand-blue" : "w-1.5 bg-white/20"}`} />
            ))}
          </span>
          {i > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setI(i - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button size="sm" onClick={() => (last ? finish() : setI(i + 1))} autoFocus>
            {last ? "Start building" : "Next"} {!last && <ArrowRight />}
          </Button>
        </div>
      </div>
    </div>
  );
}
