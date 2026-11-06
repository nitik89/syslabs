"use client";

import { AlertTriangle, CircleCheck, CircleDashed, FlaskConical, OctagonAlert, Unplug } from "lucide-react";
import { CATALOG, type Health, type SimResult } from "@/lib/sim";
import { fmtMs, fmtPct, fmtRps, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STATUS_BAR, STATUS_TEXT } from "./kind-style";
import type { SysNode } from "./model";

const HEALTH: Record<Health, { label: string; cls: string; icon: typeof CircleCheck }> = {
  idle: { label: "No traffic", cls: "text-muted-foreground bg-secondary", icon: CircleDashed },
  healthy: { label: "Healthy", cls: "text-status-ok bg-status-ok/10", icon: CircleCheck },
  degraded: { label: "Degraded", cls: "text-status-warn bg-status-warn/10", icon: AlertTriangle },
  critical: { label: "Critical", cls: "text-status-crit bg-status-crit/10", icon: OctagonAlert },
};

export function SimulatedTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-brand-violet/30 bg-brand-violet/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand-violet",
        className,
      )}
      title="Computed by SysLab's deterministic model, not measured on real infrastructure."
    >
      <FlaskConical className="size-3" aria-hidden="true" /> Simulated
    </span>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "crit" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[15px] font-semibold", tone && STATUS_TEXT[tone])}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function MetricsPanel({
  result,
  stale,
  nodes,
  onFocusNode,
}: {
  result: SimResult | null;
  stale: boolean;
  nodes: SysNode[];
  onFocusNode: (id: string) => void;
}) {
  if (!result) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <FlaskConical className="size-5 text-brand-cyan" aria-hidden="true" />
        <p className="text-sm font-medium">No results yet</p>
        <p className="text-xs text-muted-foreground">Build a design, then press Run simulation to see load, latency and failures.</p>
      </div>
    );
  }

  const h = HEALTH[result.health];
  const HIcon = h.icon;
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const errTone = result.errorRate > 0.05 ? "crit" : result.errorRate > 0.005 ? "warn" : "ok";
  const rows = nodes
    .map((n) => ({ n, r: result.nodes[n.id] }))
    .filter((x) => x.r && x.r.capacity !== null)
    .sort((a, b) => b.r.utilization - a.r.utilization);

  return (
    <div className={cn("space-y-4", stale && "opacity-60")} aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold", h.cls)}>
          <HIcon className="size-3.5" aria-hidden="true" /> {h.label}
        </span>
        <SimulatedTag />
      </div>
      {stale && (
        <p className="rounded-md border border-status-warn/30 bg-status-warn/10 px-2 py-1.5 text-[11px] text-status-warn">
          Design changed since this run. Run the simulation again to refresh.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Served" value={`${fmtRps(result.servedRps)} rps`} sub={`of ${fmtRps(result.offeredRps)} offered`} />
        <Stat label="Avg latency" value={fmtMs(result.avgLatencyMs)} sub="served requests" />
        <Stat label="Error rate" value={fmtPct(result.errorRate)} sub={`${fmtRps(result.errorRps)} rps failing`} tone={result.offeredRps > 0 ? errTone : undefined} />
        <Stat label="DB load" value={`${fmtRps(result.dbLoadRps)} rps`} sub="SQL + NoSQL" />
        <Stat label="Cache hit" value={result.cacheHitRatio === null ? "n/a" : fmtPct(result.cacheHitRatio, 0)} sub={result.cacheHitRatio === null ? "no cache in path" : "of cache lookups"} />
        <Stat label="Cost" value={fmtUsd(result.monthlyCost)} sub="per month" />
        {result.backlogRps > 0 && <Stat label="Queue backlog" value={`${fmtRps(result.backlogRps)} rps`} sub="writes piling up" tone="warn" />}
      </div>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold">Bottlenecks ({result.bottlenecks.length})</h3>
        {result.bottlenecks.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">None. Every component has headroom.</p>
        ) : (
          <ul className="space-y-1">
            {result.bottlenecks.map((b, i) => (
              <li key={`${b.nodeId}-${i}`}>
                <button
                  type="button"
                  onClick={() => onFocusNode(b.nodeId)}
                  className="flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-[12px] outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={cn("mt-1 size-2 shrink-0 rounded-full", b.severity === "crit" ? "bg-status-crit" : "bg-status-warn")} aria-hidden="true" />
                  <span>
                    <span className="sr-only">{b.severity === "crit" ? "Critical: " : "Warning: "}</span>
                    {b.reason}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1.5">
        <h3 className="text-xs font-semibold">Single points of failure ({result.spofs.length})</h3>
        {result.spofs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {result.offeredRps > 0 ? "None found. No single component failure cuts off 10% or more of traffic." : "Add a client to analyze failures."}
          </p>
        ) : (
          <ul className="space-y-1">
            {result.spofs.map((s) => (
              <li key={s.nodeId}>
                <button
                  type="button"
                  onClick={() => onFocusNode(s.nodeId)}
                  className="flex w-full gap-2 rounded-md px-2 py-1.5 text-left text-[12px] outline-none hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Unplug className="mt-0.5 size-3.5 shrink-0 text-status-crit" aria-hidden="true" />
                  <span>{s.reason}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {result.issues.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold">Design issues ({result.issues.length})</h3>
          <ul className="space-y-1">
            {result.issues.map((iss, i) => (
              <li key={i} className="flex gap-2 px-2 text-[12px] text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-status-warn" aria-hidden="true" />
                {iss.nodeId ? (
                  <button type="button" className="text-left hover:underline focus-visible:underline focus-visible:outline-none" onClick={() => onFocusNode(iss.nodeId!)}>
                    {iss.message}
                  </button>
                ) : (
                  <span>{iss.message}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="space-y-1.5">
          <h3 className="text-xs font-semibold">Utilization</h3>
          <ul className="space-y-1.5">
            {rows.map(({ n, r }) => (
              <li key={n.id} className="space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="truncate">
                    {nameOf(n.id)} <span className="text-muted-foreground">· {CATALOG[n.data.kind].label}</span>
                  </span>
                  <span className={cn("font-mono", STATUS_TEXT[r.status])}>{Math.round(r.utilization * 100)}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-secondary" role="presentation">
                  <div className={cn("h-full", STATUS_BAR[r.status])} style={{ width: `${Math.min(100, r.utilization * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
