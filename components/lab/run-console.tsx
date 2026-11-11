"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronUp, Pause, Play, RotateCcw } from "lucide-react";
import type { LogLevel, Timeline } from "@/lib/sim";
import { fmtPct, fmtRps } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export function fmtLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms)} ms`;
}

export interface ConsoleTab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

const LINE_COLORS = ["var(--status-warn)", "var(--brand-blue)", "var(--brand-cyan)", "var(--brand-violet)"];

function Tile({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "crit" }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-mono text-[14px] font-semibold tabular-nums",
          tone === "ok" && "text-status-ok",
          tone === "warn" && "text-status-warn",
          tone === "crit" && "text-status-crit",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3 rotate-90" />} {title}
      </button>
      {open && children}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-white/[0.02] p-2.5">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

const latencyConfig = {
  p50: { label: "p50", color: "var(--brand-cyan)" },
  p95: { label: "p95", color: "var(--brand-blue)" },
  p99: { label: "p99", color: "var(--status-warn)" },
} satisfies ChartConfig;
const trafficConfig = {
  served: { label: "Served req/s", color: "var(--brand-blue)" },
  errors: { label: "Errors req/s", color: "var(--status-crit)" },
} satisfies ChartConfig;

const LEVEL_STYLE: Record<LogLevel, string> = { info: "text-muted-foreground", warn: "text-status-warn", error: "text-status-crit" };

export function RunConsole({
  timeline,
  t,
  onSeek,
  playing,
  onTogglePlay,
  stale,
  status,
  tabs = [],
  tab,
  onTabChange,
  collapsed,
  onToggleCollapsed,
  monthlyCost,
  latencyTarget,
  onFocusNode,
  labels = {},
  badge,
  idle,
  costs = {},
  className,
}: {
  /** Extra classes on the console root (e.g. small-screen layout). */
  className?: string;
  /** Shown in the Run tab before the first run (e.g. the tests that will run). */
  idle?: ReactNode;
  /** Monthly cost per node id, for the components table. */
  costs?: Record<string, number>;
  /** Shown in the tab bar, so pass/fail is visible even with the console scrolled or collapsed. */
  badge?: ReactNode;
  labels?: Record<string, string>;
  timeline: Timeline | null;
  t: number;
  onSeek: (t: number) => void;
  playing: boolean;
  onTogglePlay: () => void;
  stale: boolean;
  /** Test results line(s) for the run (challenges). */
  status?: ReactNode;
  tabs?: ConsoleTab[];
  tab: string;
  onTabChange: (id: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  monthlyCost: number;
  /** Drawn as a dashed target line on the latency chart. */
  latencyTarget?: { ms: number; label: string };
  onFocusNode: (id: string) => void;
}) {
  // Height in px once the user drags the handle (null = default responsive height).
  const rootRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const resizeTo = useCallback((h: number) => {
    const parent = rootRef.current?.parentElement?.offsetHeight ?? 800;
    setHeight(Math.round(Math.min(Math.max(h, 140), parent - 140)));
  }, []);
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = rootRef.current?.offsetHeight ?? 300;
      const move = (ev: PointerEvent) => resizeTo(startH + (startY - ev.clientY));
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = "row-resize";
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [resizeTo],
  );
  const allTabs: ConsoleTab[] = [{ id: "run", label: "Run", content: null }, ...tabs, { id: "logs", label: `Logs${timeline ? ` (${timeline.events.filter((e) => e.t <= t).length})` : ""}`, content: null }];
  const tick = timeline?.ticks[Math.min(t, timeline.ticks.length - 1)];
  const last = timeline ? timeline.seconds - 1 : 59;

  const rows =
    timeline?.ticks.slice(0, t + 1).map((k) => ({
      t: k.t,
      p50: Math.round(k.p50),
      p95: Math.round(k.p95),
      p99: Math.round(k.p99),
      served: Math.round(k.servedRps),
      errors: Math.round(k.errorRps),
      ...Object.fromEntries(timeline.busiest.map((b) => [b.id, Math.round((k.utilization[b.id] ?? 0) * 100)])),
    })) ?? [];
  const busyConfig = Object.fromEntries((timeline?.busiest ?? []).map((b, i) => [b.id, { label: b.label, color: LINE_COLORS[i % LINE_COLORS.length] }])) as ChartConfig;

  const errRate = tick && tick.offeredRps > 0 ? tick.errorRps / tick.offeredRps : 0;
  // Where requests fail, as a share of all offered traffic, and the hottest component over the whole run so far.
  const failures = tick
    ? Object.values(tick.result.nodes)
        .filter((n) => n.droppedRps > 0.5)
        .map((n) => ({ id: n.id, share: tick.offeredRps > 0 ? n.droppedRps / tick.offeredRps : 0, util: n.utilization }))
        .sort((a, b) => b.share - a.share)
    : [];
  let peak: { id: string; util: number } | null = null;
  for (const k of timeline?.ticks.slice(0, t + 1) ?? []) {
    for (const [id, u] of Object.entries(k.utilization)) if (!peak || u > peak.util) peak = { id, util: u };
  }
  const name = (id: string) => labels[id] ?? id;
  const hit = tick?.result.cacheHitRatio ?? null;

  return (
    <div
      ref={rootRef}
      data-tour="console"
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col border-t border-border bg-sidebar/80",
        collapsed ? "h-10" : height === null && "h-[38%] min-h-[220px] max-h-[380px]",
        className,
      )}
      style={!collapsed && height !== null ? { height } : undefined}
    >
      {/* Drag handle: pull up for a bigger console, down for more canvas. Arrow keys work too. */}
      {!collapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize run console"
          tabIndex={0}
          onPointerDown={startDrag}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            resizeTo((height ?? rootRef.current?.offsetHeight ?? 300) + (e.key === "ArrowUp" ? 40 : -40));
          }}
          className="group absolute inset-x-0 -top-1.5 z-20 hidden h-3 cursor-row-resize items-center justify-center outline-none lg:flex"
        >
          <span className="h-1 w-12 rounded-full bg-white/15 transition-colors group-hover:bg-primary group-focus-visible:bg-primary" />
        </div>
      )}
      {/* Tab bar + transport */}
      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-1 border-b border-border px-2">
        <div role="tablist" aria-label="Run console" className="flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]">
          {allTabs.map((x) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => {
                onTabChange(x.id);
                if (collapsed) onToggleCollapsed();
              }}
              className={cn(
                "relative h-10 shrink-0 px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground",
                tab === x.id && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        {badge && <div className="ml-2 hidden sm:block">{badge}</div>}
        <div className="ml-auto flex min-w-0 items-center gap-2 max-sm:w-full max-sm:pb-1.5">
          {timeline && (
            <>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={playing ? "Pause replay" : t >= last ? "Replay" : "Play"}
                className="flex size-7 items-center justify-center rounded-md text-foreground hover:bg-white/[0.06]"
              >
                {playing ? <Pause className="size-3.5" /> : t >= last ? <RotateCcw className="size-3.5" /> : <Play className="size-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={last}
                value={t}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Simulation time"
                className="h-1 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] sm:w-48 sm:flex-none"
              />
              <span className="w-12 font-mono text-[11px] tabular-nums text-muted-foreground">t={t}s</span>
            </>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Show run console" : "Hide run console"}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground max-lg:hidden"
          >
            {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {!collapsed && tab === "run" && timeline && tick && (
        <div className={cn("shrink-0 space-y-2 border-b border-border px-3 py-2.5", stale && "opacity-60")}>
          {stale && <p className="text-[11.5px] text-status-warn">The design changed since this run. Run again to update.</p>}
          {status}
          {peak && peak.util > 1 && (
            <p className="text-[12.5px] text-status-warn">
              Requests are queueing at{" "}
              <button type="button" onClick={() => onFocusNode(peak!.id)} className="font-semibold underline-offset-2 hover:underline">
                {name(peak.id)}
              </button>{" "}
              (peak {Math.round(peak.util * 100)}% busy).
            </p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Tile label="p50" value={fmtLatency(tick.p50)} />
            <Tile label="p95" value={fmtLatency(tick.p95)} />
            <Tile label="p99" value={fmtLatency(tick.p99)} tone={tick.p99 >= 1000 ? "crit" : tick.p99 >= 300 ? "warn" : undefined} />
            <Tile label="Errors" value={fmtPct(errRate, 2)} tone={errRate > 0.01 ? "crit" : errRate > 0 ? "warn" : "ok"} />
            <Tile label="Cost" value={`$${(monthlyCost / 730).toFixed(2)}/hr`} />
            <Tile label="Cache hits" value={hit === null ? "—" : fmtPct(hit, 0)} />
            <Tile label="Throughput" value={`${fmtRps(tick.servedRps)}/s`} />
          </div>
        </div>
      )}
      {!collapsed && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === "logs" ? (
            timeline ? (
              <ol className="space-y-0.5 font-mono text-[11.5px]">
                {timeline.events
                  .filter((e) => e.t <= t)
                  .map((e, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-10 shrink-0 text-right text-muted-foreground/70">{String(e.t).padStart(2, "0")}s</span>
                      <span className={cn("w-12 shrink-0 uppercase", LEVEL_STYLE[e.level])}>{e.level}</span>
                      {e.nodeId ? (
                        <button type="button" onClick={() => onFocusNode(e.nodeId!)} className="text-left hover:underline">
                          {e.message}
                        </button>
                      ) : (
                        <span>{e.message}</span>
                      )}
                    </li>
                  ))}
              </ol>
            ) : (
              <Empty />
            )
          ) : tab !== "run" ? (
            allTabs.find((x) => x.id === tab)?.content
          ) : !timeline || !tick ? (
            idle ?? <Empty />
          ) : (
            <div className={cn("space-y-3", stale && "opacity-60")}>
              <Section title="Charts">
                <div className="grid gap-2 lg:grid-cols-3">
                  <ChartCard title="Latency (ms)">
                    <ChartContainer config={latencyConfig} className="aspect-auto h-36 w-full">
                      <LineChart data={rows} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[0, last]} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}s`} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={44} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `t=${p?.[0]?.payload?.t ?? ""}s`} />} />
                        {latencyTarget && (
                          <ReferenceLine
                            y={latencyTarget.ms}
                            stroke="var(--status-ok)"
                            strokeDasharray="4 4"
                            label={{ value: latencyTarget.label, position: "insideTopRight", fill: "var(--status-ok)", fontSize: 9 }}
                          />
                        )}
                        <Line dataKey="p99" stroke="var(--color-p99)" dot={false} strokeWidth={1.75} isAnimationActive={false} />
                        <Line dataKey="p95" stroke="var(--color-p95)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                        <Line dataKey="p50" stroke="var(--color-p50)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                      </LineChart>
                    </ChartContainer>
                  </ChartCard>
                  <ChartCard title="Traffic (req/s) and errors">
                    <ChartContainer config={trafficConfig} className="aspect-auto h-36 w-full">
                      <LineChart data={rows} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[0, last]} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}s`} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={44} tickFormatter={(v) => fmtRps(v)} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `t=${p?.[0]?.payload?.t ?? ""}s`} />} />
                        <Line dataKey="served" stroke="var(--color-served)" dot={false} strokeWidth={1.75} isAnimationActive={false} />
                        <Line dataKey="errors" stroke="var(--color-errors)" dot={false} strokeWidth={1.5} isAnimationActive={false} />
                      </LineChart>
                    </ChartContainer>
                  </ChartCard>
                  <ChartCard title="Busiest components (% of capacity)">
                    <ChartContainer config={busyConfig} className="aspect-auto h-36 w-full">
                      <LineChart data={rows} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="t" type="number" domain={[0, last]} tickLine={false} axisLine={false} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}s`} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 9 }} width={44} tickFormatter={(v) => `${v}%`} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => `t=${p?.[0]?.payload?.t ?? ""}s`} />} />
                        <ReferenceLine y={100} stroke="var(--status-crit)" strokeDasharray="4 4" strokeOpacity={0.6} />
                        <ReferenceLine y={80} stroke="var(--status-warn)" strokeDasharray="2 4" strokeOpacity={0.5} />
                        {timeline.busiest.map((b) => (
                          <Line key={b.id} dataKey={b.id} stroke={`var(--color-${b.id})`} dot={false} strokeWidth={1.5} isAnimationActive={false} />
                        ))}
                      </LineChart>
                    </ChartContainer>
                  </ChartCard>
                </div>
              </Section>
              <Section title="Components">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[560px] text-[12px]">
                    <thead>
                      <tr className="border-b border-border bg-white/[0.02] text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        <th className="px-3 py-2 font-normal">Component</th>
                        <th className="px-3 py-2 text-right font-normal">Load</th>
                        <th className="w-40 px-3 py-2 font-normal">Busy</th>
                        <th className="px-3 py-2 text-right font-normal">Latency</th>
                        <th className="px-3 py-2 text-right font-normal">Dropped</th>
                        <th className="px-3 py-2 text-right font-normal">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Object.values(tick.result.nodes)
                        .filter((n) => n.capacity !== null || n.load > 0)
                        .sort((a, b) => b.utilization - a.utilization)
                        .map((n) => {
                          const u = n.utilization;
                          const tone = u > 1 ? "bg-status-crit" : u >= 0.8 ? "bg-status-warn" : n.load > 0 ? "bg-status-ok" : "bg-muted-foreground/40";
                          return (
                            <tr key={n.id} className="hover:bg-white/[0.02]">
                              <td className="px-3 py-1.5">
                                <button type="button" onClick={() => onFocusNode(n.id)} className="font-medium hover:underline">
                                  {name(n.id)}
                                </button>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{fmtRps(n.load)}/s</td>
                              <td className="px-3 py-1.5">
                                {n.capacity !== null ? (
                                  <span className="flex items-center gap-2">
                                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                                      <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.min(100, u * 100)}%` }} />
                                    </span>
                                    <span className="w-10 text-right font-mono tabular-nums text-muted-foreground">{Math.round(u * 100)}%</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-muted-foreground">unlimited</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums">{n.load > 0 ? fmtLatency(n.latencyMs) : "—"}</td>
                              <td className={cn("px-3 py-1.5 text-right font-mono tabular-nums", n.droppedRps > 0.5 ? "text-status-crit" : "text-muted-foreground")}>
                                {n.droppedRps > 0.5 ? `${fmtRps(n.droppedRps)}/s` : "0"}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono tabular-nums text-muted-foreground">
                                {costs[n.id] !== undefined ? `$${(costs[n.id] / 730).toFixed(2)}/hr` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </Section>
              {(tick.result.bottlenecks.length > 0 || tick.result.spofs.length > 0 || tick.result.issues.length > 0) && (
                <Section title="What to fix">
                  <ul className="space-y-1.5">
                    {tick.result.bottlenecks.map((b) => (
                      <li key={`b-${b.nodeId}`} className="flex gap-2 rounded-lg border border-status-warn/25 bg-status-warn/[0.05] px-3 py-2 text-[12.5px]">
                        <span className="font-mono text-[10.5px] font-semibold uppercase text-status-warn">Hot</span>
                        <button type="button" onClick={() => onFocusNode(b.nodeId)} className="text-left hover:underline">
                          {b.reason}
                        </button>
                      </li>
                    ))}
                    {tick.result.spofs.map((x) => (
                      <li key={`s-${x.nodeId}`} className="flex gap-2 rounded-lg border border-status-crit/25 bg-status-crit/[0.05] px-3 py-2 text-[12.5px]">
                        <span className="font-mono text-[10.5px] font-semibold uppercase text-status-crit">SPOF</span>
                        <button type="button" onClick={() => onFocusNode(x.nodeId)} className="text-left hover:underline">
                          {x.reason}
                        </button>
                      </li>
                    ))}
                    {tick.result.issues.map((x, i) => (
                      <li key={`i-${i}`} className="flex gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2 text-[12.5px]">
                        <span className="font-mono text-[10.5px] font-semibold uppercase text-muted-foreground">Note</span>
                        <span>{x.message}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              {failures.length > 0 && (
                <Section title={`Why requests failed (${failures.length})`}>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {failures.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                        <button type="button" onClick={() => onFocusNode(f.id)} className="flex-1 text-left text-status-crit hover:underline">
                          {f.util > 1 ? `503 · ${name(f.id)} overloaded (${Math.round(f.util * 100)}% busy, requests time out in its queue)` : `${name(f.id)} has no route for this traffic`}
                        </button>
                        <span className="font-mono text-[11.5px] tabular-nums text-muted-foreground">{fmtPct(f.share, 2)}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full min-h-24 flex-col items-center justify-center gap-1 text-center">
      <p className="text-[13px] font-medium">No run yet</p>
      <p className="text-[11.5px] text-muted-foreground">Press Run (⌘↵) to push 60 seconds of traffic through your design and watch latency, errors and load.</p>
    </div>
  );
}
