"use client";

import { createContext, memo, useContext, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CATALOG, INDEXABLE_KINDS, nodeSpec } from "@/lib/sim";
import { fmtRps } from "@/lib/format";
import type { SysNode } from "./model";
import { KindIcon } from "./kind-icon";
import { KIND_ACCENT, STATUS_BAR, STATUS_LABEL, STATUS_RING, STATUS_TEXT } from "./kind-style";

/** Lets a node rename itself (double-click on the canvas). Provided by the designer so it goes through undo. */
export const RenameNodeContext = createContext<(id: string, label: string) => void>(() => {});

function SysNodeView({ id, data, selected }: NodeProps<SysNode>) {
  const spec = CATALOG[data.kind];
  const name = data.label.trim() || spec.label;
  const rename = useContext(RenameNodeContext);
  const [editing, setEditing] = useState(false);
  const subtitle = data.kind === "custom" ? `Custom · ${CATALOG[nodeSpec(data).behavior].label}` : spec.label;
  const r = data.result;
  const status = r?.status;
  const isSource = data.kind === "client";
  const pct = r ? Math.min(100, Math.round(r.utilization * 100)) : 0;

  return (
    <div
      className={cn(
        "relative w-[204px] rounded-2xl border bg-card/95 px-3 py-2.5 shadow-[0_10px_30px_-14px_var(--shadow)] text-card-foreground backdrop-blur transition-[border-color,box-shadow]",
        status ? STATUS_RING[status] : "border-border",
        selected && "outline-2 outline-offset-2 outline-ring",
      )}
      aria-label={`${name} (${spec.label})${status ? `, ${STATUS_LABEL[status]}` : ""}`}
    >
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 rounded-2xl opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_75%)]", KIND_ACCENT[data.kind])}
      />
      <span aria-hidden="true" className={cn("pointer-events-none absolute inset-x-4 top-0 h-px bg-current opacity-60", KIND_ACCENT[data.kind])} />
      {!isSource && (
        <Handle type="target" position={Position.Left} className="!size-3.5 !border-2 !border-background !bg-brand-blue transition-transform hover:!scale-125" />
      )}
      <div className="relative flex items-center gap-2.5">
        <KindIcon kind={data.kind} size="xl" />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              aria-label="Component name"
              defaultValue={name}
              maxLength={40}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                rename(id, e.currentTarget.value);
                setEditing(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
              className="nodrag nopan w-full rounded border border-ring bg-background px-1 text-[14px] font-semibold leading-tight outline-none"
            />
          ) : (
            <p
              className="truncate text-[14px] font-semibold leading-tight"
              title="Double-click the name to rename"
              onDoubleClick={(e) => {
                e.stopPropagation(); // rename, don't open the inspector
                setEditing(true);
              }}
            >
              {name}
            </p>
          )}
          <p className="truncate text-[11.5px] text-muted-foreground">{subtitle}</p>
        </div>
        {data.config.indexes === "none" && INDEXABLE_KINDS.has(nodeSpec(data).behavior) && (
          <span className="rounded-md bg-status-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-status-warn" title="No indexes: reads scan the whole table">
            no index
          </span>
        )}
        {data.config.handles && data.config.handles.length > 0 && data.config.handles.length < 3 && (
          <span
            className="rounded-md bg-brand-blue/15 px-1.5 py-0.5 font-mono text-[10px] text-brand-blue"
            title={`Handles only: ${data.config.handles.join(", ")} requests`}
          >
            {[...data.config.handles]
              .sort()
              .map((c) => (c === "read" ? "GET" : c === "write" ? "POST" : "static"))
              .join("+")}
          </span>
        )}
        {data.config.replicas > 1 && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            ×{data.config.replicas}
          </span>
        )}
      </div>

      {spec.includes && !r && (
        <ul className="relative mt-2 flex flex-wrap gap-1" aria-label="Built-in features">
          {spec.includes.slice(1, 5).map((f) => (
            <li key={f} className="rounded bg-white/[0.06] px-1.5 py-px text-[9.5px] font-medium text-muted-foreground">
              {f.replace(/ \(.*\)$/, "").replace("L7 load balancing", "Load balancing")}
            </li>
          ))}
        </ul>
      )}
      {r && r.capacity !== null && (
        <div className="relative mt-2 space-y-1">
          {/* One segment per replica (load is spread evenly across them). */}
          <div className="flex gap-0.5" aria-hidden="true">
            {Array.from({ length: Math.min(Math.max(data.config.replicas, 1), 8) }, (_, i) => (
              <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/[0.08]">
                <div className={cn("h-full rounded-sm transition-[width] duration-150", STATUS_BAR[r.status])} style={{ width: `${pct}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between font-mono text-[10.5px]">
            <span className={STATUS_TEXT[r.status]}>{Math.round(r.utilization * 100)}% busy</span>
            <span className="text-muted-foreground">{fmtRps(r.load)} rps</span>
          </div>
          {r.hitRatio !== undefined && (
            <p className="font-mono text-[10px] text-muted-foreground">hit {Math.round(r.hitRatio * 100)}%</p>
          )}
        </div>
      )}
      {r && r.capacity === null && data.kind === "client" && (
        <p className="relative mt-2 font-mono text-[10.5px] text-muted-foreground">traffic source · {fmtRps(r.load)} rps</p>
      )}

      <Handle type="source" position={Position.Right} className="!size-3.5 !border-2 !border-background !bg-brand-violet transition-transform hover:!scale-125" />
    </div>
  );
}

export const SysNodeComponent = memo(SysNodeView);
