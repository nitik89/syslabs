"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { CATALOG } from "@/lib/sim";
import { fmtRps } from "@/lib/format";
import type { SysNode } from "./model";
import { KIND_ACCENT, KIND_ICON, STATUS_BAR, STATUS_LABEL, STATUS_RING, STATUS_TEXT } from "./kind-style";

function SysNodeView({ data, selected }: NodeProps<SysNode>) {
  const spec = CATALOG[data.kind];
  const Icon = KIND_ICON[data.kind];
  const r = data.result;
  const status = r?.status;
  const isSource = data.kind === "client";
  const pct = r ? Math.min(100, Math.round(r.utilization * 100)) : 0;

  return (
    <div
      className={cn(
        "w-[188px] rounded-xl border bg-card/95 px-3 py-2.5 text-card-foreground backdrop-blur transition-[border-color,box-shadow]",
        status ? STATUS_RING[status] : "border-border",
        selected && "outline-2 outline-offset-2 outline-ring",
      )}
      aria-label={`${data.label} (${spec.label})${status ? `, ${STATUS_LABEL[status]}` : ""}`}
    >
      {!isSource && (
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-background !bg-brand-blue" />
      )}
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", KIND_ACCENT[data.kind])}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-tight">{data.label}</p>
          <p className="truncate text-[11px] text-muted-foreground">{spec.label}</p>
        </div>
        {data.config.replicas > 1 && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-secondary-foreground">
            ×{data.config.replicas}
          </span>
        )}
      </div>

      {r && r.capacity !== null && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-muted-foreground">{fmtRps(r.load)} rps</span>
            <span className={STATUS_TEXT[r.status]}>{Math.round(r.utilization * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-full rounded-full", STATUS_BAR[r.status])} style={{ width: `${pct}%` }} />
          </div>
          {r.hitRatio !== undefined && (
            <p className="font-mono text-[10px] text-muted-foreground">hit {Math.round(r.hitRatio * 100)}%</p>
          )}
        </div>
      )}
      {r && r.capacity === null && data.kind === "client" && (
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">{fmtRps(r.load)} rps out</p>
      )}

      <Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-background !bg-brand-violet" />
    </div>
  );
}

export const SysNodeComponent = memo(SysNodeView);
