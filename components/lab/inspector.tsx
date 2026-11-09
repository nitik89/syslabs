"use client";

import { useId, useState } from "react";
import { ArrowRight, Link2, Lock, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG, CUSTOM_BEHAVIORS, INDEXABLE_KINDS, INDEX_EFFECT, cacheHitRatio, nodeSpec, type BaseKind, type IndexLevel, type NodeConfig, type TrafficProfile } from "@/lib/sim";
import { fmtPct, fmtUsd } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KindIcon } from "./kind-icon";
import { connectionProblem, nodeName, type FlowEdge, type SysNode } from "./model";
import { FractionField, NumberField } from "./number-field";

export function NodeInspector({
  node,
  nodes,
  edges,
  traffic,
  onChangeLabel,
  onChangeConfig,
  onDelete,
  onConnect,
  onRemoveEdge,
  onSelect,
}: {
  node: SysNode;
  nodes: SysNode[];
  edges: FlowEdge[];
  traffic: TrafficProfile;
  onChangeLabel: (label: string) => void;
  onChangeConfig: (patch: Partial<NodeConfig>) => void;
  onDelete: () => void;
  onConnect: (target: string) => void;
  onRemoveEdge: (edgeId: string) => void;
  onSelect: (id: string) => void;
}) {
  const spec = nodeSpec({ kind: node.data.kind, config: node.data.config });
  const cfg = node.data.config;
  const labelId = useId();
  const connectId = useId();
  const behaviorId = useId();
  const indexId = useId();
  const indexLevel: IndexLevel = cfg.indexes ?? "standard";
  const [connectTarget, setConnectTarget] = useState("");

  const nameOf = (id: string) => {
    const f = nodes.find((n) => n.id === id);
    return f ? nodeName(f) : id;
  };
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);
  const candidates = nodes.filter((n) => connectionProblem(node.id, n.id, nodes, edges) === null);
  const hasCapacity = !spec.unlimited;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <KindIcon kind={node.data.kind} size="xl" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{spec.label}</p>
          <p className="text-xs text-muted-foreground">{spec.description}</p>
        </div>
      </div>
      <p className="rounded-lg border border-border bg-secondary/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">In the simulator: </span>
        {spec.simBehavior}
      </p>
      {spec.includes && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Built in</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Built-in features">
            {spec.includes.map((f) => (
              <li key={f} className="rounded-md bg-brand-cyan/10 px-2 py-0.5 text-[11px] font-medium text-brand-cyan ring-1 ring-inset ring-brand-cyan/20">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor={labelId} className="text-xs text-muted-foreground">
          Name
        </Label>
        <Input id={labelId} value={node.data.label} maxLength={40} onChange={(e) => onChangeLabel(e.target.value)} className="h-8 text-[13px]" />
      </div>

      {node.data.kind === "custom" && (
        <div className="space-y-1">
          <Label htmlFor={behaviorId} className="text-xs text-muted-foreground">
            Behaves like
          </Label>
          <select
            id={behaviorId}
            value={spec.behavior}
            onChange={(e) => {
              const b = e.target.value as BaseKind;
              // Start from that block's defaults so capacity, latency and cost make sense for it.
              onChangeConfig({ ...CATALOG[b].defaults, behavior: b });
            }}
            className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CUSTOM_BEHAVIORS.map((b) => (
              <option key={b} value={b}>
                {CATALOG[b].label} ({CATALOG[b].short})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">Resets capacity, latency and cost to that block&apos;s defaults. Tune them after.</p>
        </div>
      )}

      {INDEXABLE_KINDS.has(spec.behavior) && (
        <div className="space-y-1">
          <Label htmlFor={indexId} className="text-xs text-muted-foreground">
            Indexes
          </Label>
          <select
            id={indexId}
            value={indexLevel}
            onChange={(e) => onChangeConfig({ indexes: e.target.value as IndexLevel })}
            className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="none">None: every read scans the whole table</option>
            <option value="standard">Standard: indexes on the columns you query</option>
            <option value="heavy">Heavy: many / covering indexes</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            {INDEX_HINT[indexLevel]} Reads {fmtMultiplier(INDEX_EFFECT[indexLevel].read)} capacity · writes {fmtMultiplier(INDEX_EFFECT[indexLevel].write)} · latency{" "}
            {fmtMultiplier(INDEX_EFFECT[indexLevel].latency)}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {hasCapacity && (
          <NumberField label="Capacity / replica" suffix="rps" value={cfg.capacity} min={0} max={10_000_000} integer onCommit={(v) => onChangeConfig({ capacity: v })} />
        )}
        <NumberField label="Base latency" suffix="ms" value={cfg.latencyMs} min={0} max={10_000} step={0.5} onCommit={(v) => onChangeConfig({ latencyMs: v })} />
        {node.data.kind !== "client" && (
          <NumberField
            label={spec.behavior === "sqlDb" ? "Replicas (read)" : "Replicas"}
            value={cfg.replicas}
            min={1}
            max={100}
            integer
            onCommit={(v) => onChangeConfig({ replicas: v })}
          />
        )}
        {node.data.kind !== "client" && (
          <NumberField label="Cost / replica" suffix="$/mo" value={cfg.costPerReplica} min={0} max={1_000_000} integer onCommit={(v) => onChangeConfig({ costPerReplica: v })} />
        )}
        {spec.behavior === "cache" && (
          <NumberField
            label="Cache size"
            suffix="GB"
            value={cfg.cacheSizeGb ?? 0}
            min={0}
            max={1024}
            step={1}
            onCommit={(v) => onChangeConfig({ cacheSizeGb: v })}
            hint={`Hit ratio at current traffic: ${fmtPct(cacheHitRatio(traffic.hotKeyFraction, cfg.cacheSizeGb ?? 0), 0)}`}
          />
        )}
      </div>
      {node.data.kind !== "client" && (
        <p className="text-[11px] text-muted-foreground">
          Monthly: <span className="font-mono text-foreground">{fmtUsd(cfg.costPerReplica * cfg.replicas)}</span>
          {hasCapacity && (
            <>
              {" "}· Total capacity: <span className="font-mono text-foreground">{(cfg.capacity * cfg.replicas).toLocaleString()} rps</span>
            </>
          )}
        </p>
      )}

      <Separator />

      <section className="space-y-2" aria-labelledby={`${connectId}-h`}>
        <h3 id={`${connectId}-h`} className="text-xs font-semibold">
          Connections
        </h3>
        {outgoing.length === 0 && incoming.length === 0 && <p className="text-[11px] text-muted-foreground">Not connected yet.</p>}
        <ul className="space-y-1">
          {incoming.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-md bg-secondary/40 px-2 py-1 text-[12px]">
              <button type="button" className="truncate text-left hover:underline focus-visible:underline focus-visible:outline-none" onClick={() => onSelect(e.source)}>
                {nameOf(e.source)}
              </button>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate text-muted-foreground">this</span>
              <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Remove connection from ${nameOf(e.source)}`} onClick={() => onRemoveEdge(e.id)}>
                <X />
              </Button>
            </li>
          ))}
          {outgoing.map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-md bg-secondary/40 px-2 py-1 text-[12px]">
              <span className="truncate text-muted-foreground">this</span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              <button type="button" className="truncate text-left hover:underline focus-visible:underline focus-visible:outline-none" onClick={() => onSelect(e.target)}>
                {nameOf(e.target)}
              </button>
              <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Remove connection to ${nameOf(e.target)}`} onClick={() => onRemoveEdge(e.id)}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
        {candidates.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor={connectId} className="text-xs text-muted-foreground">
                Send traffic to
              </Label>
              <select
                id={connectId}
                value={connectTarget}
                onChange={(e) => setConnectTarget(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-input/30 px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a component…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {nodeName(c)}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!connectTarget}
              onClick={() => {
                onConnect(connectTarget);
                setConnectTarget("");
              }}
            >
              <Link2 /> Connect
            </Button>
          </div>
        )}
      </section>

      <Separator />

      <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
        <Trash2 /> Delete component
      </Button>
    </div>
  );
}

export function TrafficEditor({
  traffic,
  onChange,
  locked,
}: {
  traffic: TrafficProfile;
  onChange: (t: TrafficProfile) => void;
  locked?: boolean;
}) {
  if (locked) return <LockedTraffic traffic={traffic} />;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Traffic profile</h3>
        <p className="text-xs text-muted-foreground">
          {locked ? "Fixed by this challenge." : "The load your clients generate. Split evenly across Client nodes."}
        </p>
      </div>
      <NumberField
        label="Requests per second"
        suffix="rps"
        value={traffic.rps}
        min={0}
        max={10_000_000}
        integer
        disabled={locked}
        onCommit={(v) => onChange({ ...traffic, rps: v })}
      />
      <FractionField
        label="Read share (of dynamic traffic)"
        value={traffic.readRatio}
        disabled={locked}
        onChange={(v) => onChange({ ...traffic, readRatio: v })}
        hint={`${Math.round(traffic.readRatio * 100)}% reads / ${Math.round((1 - traffic.readRatio) * 100)}% writes`}
      />
      <FractionField
        label="Hot-key fraction"
        value={traffic.hotKeyFraction}
        disabled={locked}
        onChange={(v) => onChange({ ...traffic, hotKeyFraction: v })}
        hint="Share of reads hitting popular keys. Higher means caches hit more often."
      />
      <FractionField
        label="Static asset share"
        value={traffic.staticFraction}
        disabled={locked}
        onChange={(v) => onChange({ ...traffic, staticFraction: v })}
        hint="Images, JS and CSS. A CDN absorbs these."
      />
      <FractionField
        label="Contended write share"
        value={traffic.contendedWriteFraction ?? 0}
        disabled={locked}
        onChange={(v) => onChange({ ...traffic, contendedWriteFraction: v })}
        hint="Writes racing for the same item (a seat, the last unit in stock). Needs a Redis Lock or ZooKeeper."
      />
      <FractionField
        label="AI request share"
        value={traffic.aiFraction ?? 0}
        disabled={locked}
        onChange={(v) => onChange({ ...traffic, aiFraction: v })}
        hint="Requests that call a model. Servers connected to an LLM make one call each."
      />
    </div>
  );
}

/** Read-only traffic for challenges: a summary card instead of disabled sliders. */
function LockedTraffic({ traffic }: { traffic: TrafficProfile }) {
  const pct = (v: number) => Math.round(v * 100);
  const rows: Array<{ label: string; value: number; hint: string; tone: string }> = [
    { label: "Hot keys", value: traffic.hotKeyFraction, hint: "Reads hitting popular keys. Higher means caches hit more often.", tone: "bg-brand-cyan" },
    { label: "Static assets", value: traffic.staticFraction, hint: "Images, JS and CSS. A CDN absorbs these.", tone: "bg-brand-blue" },
    { label: "Contended writes", value: traffic.contendedWriteFraction ?? 0, hint: "Writes racing for the same item. Needs a Redis Lock or ZooKeeper.", tone: "bg-status-warn" },
    { label: "AI requests", value: traffic.aiFraction ?? 0, hint: "Requests that call a model.", tone: "bg-brand-violet" },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Traffic profile</h3>
          <p className="text-xs text-muted-foreground">Set by this challenge. Design for it.</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
          <Lock className="size-3" aria-hidden="true" /> Fixed
        </span>
      </div>

      <div className="surface rounded-xl p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Incoming load</p>
        <p className="mt-1 font-mono text-[28px] font-semibold leading-none tracking-tight">
          {traffic.rps.toLocaleString()}
          <span className="ml-1.5 text-sm font-normal text-muted-foreground">rps</span>
        </p>
        <div className="mt-4 space-y-1.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true">
            <div className="bg-brand-cyan" style={{ width: `${pct(traffic.readRatio)}%` }} />
            <div className="bg-brand-violet" style={{ width: `${100 - pct(traffic.readRatio)}%` }} />
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-cyan" aria-hidden="true" />
              Reads <span className="font-mono text-muted-foreground">{pct(traffic.readRatio)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-brand-violet" aria-hidden="true" />
              Writes <span className="font-mono text-muted-foreground">{100 - pct(traffic.readRatio)}%</span>
            </span>
          </div>
        </div>
      </div>

      <ul className="surface divide-y divide-border rounded-xl">
        {rows.map((r) => (
          <li key={r.label} className="space-y-1.5 px-4 py-3" title={r.hint}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{r.label}</span>
              <span className={cn("font-mono", r.value > 0 ? "text-foreground" : "text-muted-foreground")}>{pct(r.value)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={cn("h-full rounded-full", r.tone)} style={{ width: `${pct(r.value)}%` }} />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{r.hint}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

const INDEX_HINT: Record<IndexLevel, string> = {
  none: "Fine for tiny tables, a disaster at scale.",
  standard: "The sensible default.",
  heavy: "Faster reads, but every write must update every index.",
};

function fmtMultiplier(x: number): string {
  return `×${Number.isInteger(x) ? x : x.toFixed(1)}`;
}
