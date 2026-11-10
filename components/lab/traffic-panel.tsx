"use client";

import { useId } from "react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrafficProfile } from "@/lib/sim";
import { Button } from "@/components/ui/button";

/** Reads, writes and static requests per second implied by a traffic profile. */
export function trafficSplit(t: TrafficProfile) {
  const stat = t.rps * t.staticFraction;
  const dynamic = t.rps - stat;
  return { reads: dynamic * t.readRatio, writes: dynamic * (1 - t.readRatio), stat };
}

/** Rebuild a profile from per-second reads, writes and static requests (keeping the other shares). */
export function fromSplit(t: TrafficProfile, reads: number, writes: number, stat: number): TrafficProfile {
  const r = Math.max(0, reads);
  const w = Math.max(0, writes);
  const s = Math.max(0, stat);
  const dynamic = r + w;
  const rps = dynamic + s;
  return {
    ...t,
    rps: Math.round(rps),
    readRatio: dynamic > 0 ? r / dynamic : t.readRatio,
    staticFraction: rps > 0 ? s / rps : 0,
  };
}

const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${Math.round(n / 1000)}k` : Math.round(n).toLocaleString("en-US"));

/** Log-scale slider (0 … max) with a number box: covers 10 req/s to millions without fiddly precision. */
function RateField({ label, hint, value, max, tone, onChange }: { label: string; hint: string; value: number; max: number; tone: string; onChange: (v: number) => void }) {
  const id = useId();
  const toPos = (v: number) => (v <= 0 ? 0 : Math.log10(v + 1) / Math.log10(max + 1));
  const fromPos = (p: number) => (p <= 0 ? 0 : Math.round(10 ** (p * Math.log10(max + 1)) - 1));
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-2 text-[13px] font-medium">
          <span className={cn("size-2 rounded-full", tone)} aria-hidden="true" />
          {label}
        </label>
        <span className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={max}
            value={Math.round(value)}
            onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value) || 0)))}
            aria-label={`${label} per second`}
            className="h-7 w-24 rounded-md border border-border bg-background px-2 text-right font-mono text-[12.5px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="font-mono text-[11px] text-muted-foreground">/s</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1000}
        value={Math.round(toPos(value) * 1000)}
        onChange={(e) => onChange(fromPos(Number(e.target.value) / 1000))}
        className="h-2 w-full cursor-pointer accent-[var(--primary)]"
      />
      <p className="text-[11.5px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

function ShareField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-[13px] font-medium">
          {label}
        </label>
        <span className="font-mono text-[12.5px] tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-2 w-full cursor-pointer accent-[var(--primary)]"
      />
      <p className="text-[11.5px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}

const PRESETS: { label: string; factor: number }[] = [
  { label: "Quiet ×0.5", factor: 0.5 },
  { label: "Normal", factor: 1 },
  { label: "Peak ×2", factor: 2 },
  { label: "Spike ×5", factor: 5 },
  { label: "Viral ×10", factor: 10 },
];

/**
 * Traffic controls: reads, writes and static requests per second, plus hot keys, contended writes and AI
 * share. `base` is the brief's traffic on problem pages: edits are a what-if, and presets scale from it.
 */
export function TrafficControls({ traffic, onChange, base }: { traffic: TrafficProfile; onChange: (t: TrafficProfile) => void; base?: TrafficProfile }) {
  const { reads, writes, stat } = trafficSplit(traffic);
  const ref = base ?? traffic;
  const max = Math.max(1_000_000, ref.rps * 20);
  const total = Math.max(1, traffic.rps);
  const whatIf = base !== undefined && JSON.stringify(base) !== JSON.stringify(traffic);
  const scaled = (f: number) => ({ ...ref, rps: Math.round(ref.rps * f) });

  return (
    <div className="space-y-5">
      {base && (
        <div className={cn("flex gap-2.5 rounded-xl border p-3 text-[12px] leading-relaxed", whatIf ? "border-status-warn/35 bg-status-warn/[0.07]" : "border-border bg-white/[0.02]")}>
          <FlaskConical className={cn("mt-0.5 size-4 shrink-0", whatIf ? "text-status-warn" : "text-muted-foreground")} aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <p>
              {whatIf ? <span className="font-semibold text-status-warn">What-if traffic. </span> : <span className="font-semibold">Brief traffic. </span>}
              Try any load and press Run. <span className="font-semibold">Submit always grades against the brief</span> ({fmt(base.rps)} req/s, {Math.round(base.readRatio * 100)}% reads).
            </p>
            {whatIf && (
              <Button size="xs" variant="outline" onClick={() => onChange({ ...base })}>
                <RotateCcw /> Reset to brief
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Summary and mix */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Total", traffic.rps, "text-foreground"],
            ["Reads", reads, "text-brand-blue"],
            ["Writes", writes, "text-status-warn"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="rounded-xl border border-border bg-white/[0.02] px-2 py-2">
              <p className={cn("font-mono text-[16px] font-semibold tabular-nums", c as string)}>{fmt(v as number)}</p>
              <p className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{l as string}/s</p>
            </div>
          ))}
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={`Mix: ${Math.round((stat / total) * 100)}% static, ${Math.round((reads / total) * 100)}% reads, ${Math.round((writes / total) * 100)}% writes`}>
          <span className="bg-brand-cyan" style={{ width: `${(stat / total) * 100}%` }} />
          <span className="bg-brand-blue" style={{ width: `${(reads / total) * 100}%` }} />
          <span className="bg-status-warn" style={{ width: `${(writes / total) * 100}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
          <span>
            <span className="text-brand-cyan">■</span> static {Math.round((stat / total) * 100)}%
          </span>
          <span>
            <span className="text-brand-blue">■</span> reads {Math.round((reads / total) * 100)}%
          </span>
          <span>
            <span className="text-status-warn">■</span> writes {Math.round((writes / total) * 100)}%
          </span>
        </p>
      </div>

      {/* Presets */}
      <div className="space-y-1.5">
        <p className="text-[12px] font-medium text-muted-foreground">Load presets{base ? " (from the brief)" : ""}</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = Math.round(ref.rps * p.factor) === traffic.rps;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(scaled(p.factor))}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-brand-blue/50 bg-brand-blue/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <RateField
        label="Reads"
        tone="bg-brand-blue"
        value={reads}
        max={max}
        onChange={(v) => onChange(fromSplit(traffic, v, writes, stat))}
        hint="Page views, lookups and searches. Caches, replicas and CDNs absorb these."
      />
      <RateField
        label="Writes"
        tone="bg-status-warn"
        value={writes}
        max={max}
        onChange={(v) => onChange(fromSplit(traffic, reads, v, stat))}
        hint="Posts, orders and updates. They all reach a primary database, a queue or a shard."
      />
      <RateField
        label="Static files"
        tone="bg-brand-cyan"
        value={stat}
        max={max}
        onChange={(v) => onChange(fromSplit(traffic, reads, writes, v))}
        hint="Images, scripts and styles. A CDN serves these at the edge."
      />

      <div className="space-y-5 border-t border-border pt-5">
        <ShareField
          label="Hot keys"
          value={traffic.hotKeyFraction}
          onChange={(v) => onChange({ ...traffic, hotKeyFraction: v })}
          hint="Share of reads that hit a few popular items. Higher means caches hit more often."
        />
        <ShareField
          label="Contended writes"
          value={traffic.contendedWriteFraction ?? 0}
          onChange={(v) => onChange({ ...traffic, contendedWriteFraction: v })}
          hint="Writes racing for the same item (a seat, the last unit in stock). Needs a lock."
        />
        <ShareField
          label="AI requests"
          value={traffic.aiFraction ?? 0}
          onChange={(v) => onChange({ ...traffic, aiFraction: v })}
          hint="Share of dynamic requests that call a model through an app server connected to an LLM."
        />
      </div>
    </div>
  );
}

/** The Traffic side panel: a drawer on the right of the canvas (a bottom sheet on phones). */
export function TrafficPanel({ open, onClose, traffic, onChange, base }: { open: boolean; onClose: () => void; traffic: TrafficProfile; onChange: (t: TrafficProfile) => void; base?: TrafficProfile }) {
  return (
    <aside
      hidden={!open}
      aria-label="Traffic"
      className="absolute inset-y-0 right-0 z-30 w-[min(92vw,340px)] overflow-y-auto border-l border-border bg-sidebar shadow-[-24px_0_48px_-24px_var(--shadow)] max-sm:inset-x-0 max-sm:top-auto max-sm:max-h-[78%] max-sm:w-auto max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur">
        <div>
          <h2 className="text-[14px] font-semibold">Traffic</h2>
          <p className="text-[11.5px] text-muted-foreground">How much load hits your design, and what kind.</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close traffic panel">
          <X />
        </Button>
      </div>
      <div className="p-4">
        <TrafficControls traffic={traffic} onChange={onChange} base={base} />
      </div>
    </aside>
  );
}
