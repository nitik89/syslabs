"use client";

import { useId, useState } from "react";
import { ArrowRight, Link2, Trash2, X } from "lucide-react";
import { CATALOG, cacheHitRatio, type NodeConfig, type TrafficProfile } from "@/lib/sim";
import { fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KIND_ACCENT, KIND_ICON } from "./kind-style";
import { connectionProblem, type FlowEdge, type SysNode } from "./model";
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
  const spec = CATALOG[node.data.kind];
  const Icon = KIND_ICON[node.data.kind];
  const cfg = node.data.config;
  const labelId = useId();
  const connectId = useId();
  const [connectTarget, setConnectTarget] = useState("");

  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id;
  const outgoing = edges.filter((e) => e.source === node.id);
  const incoming = edges.filter((e) => e.target === node.id);
  const candidates = nodes.filter((n) => connectionProblem(node.id, n.id, nodes, edges) === null);
  const hasCapacity = !spec.unlimited;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", KIND_ACCENT[node.data.kind])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{spec.label}</p>
          <p className="text-xs text-muted-foreground">{spec.description}</p>
        </div>
      </div>
      <p className="rounded-lg border border-border bg-secondary/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">In the simulator: </span>
        {spec.simBehavior}
      </p>

      <div className="space-y-1">
        <Label htmlFor={labelId} className="text-xs text-muted-foreground">
          Name
        </Label>
        <Input id={labelId} value={node.data.label} maxLength={40} onChange={(e) => onChangeLabel(e.target.value)} className="h-8 text-[13px]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {hasCapacity && (
          <NumberField label="Capacity / replica" suffix="rps" value={cfg.capacity} min={0} max={10_000_000} integer onCommit={(v) => onChangeConfig({ capacity: v })} />
        )}
        <NumberField label="Base latency" suffix="ms" value={cfg.latencyMs} min={0} max={10_000} step={0.5} onCommit={(v) => onChangeConfig({ latencyMs: v })} />
        {node.data.kind !== "client" && (
          <NumberField
            label={node.data.kind === "sqlDb" ? "Replicas (read)" : "Replicas"}
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
        {node.data.kind === "cache" && (
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
                    {c.data.label}
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
    </div>
  );
}
