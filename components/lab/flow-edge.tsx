"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { fmtRps } from "@/lib/format";
import type { FlowEdge } from "./model";

const STATUS_STROKE = {
  idle: "var(--brand-blue)",
  ok: "var(--brand-cyan)",
  warn: "var(--status-warn)",
  crit: "var(--status-crit)",
} as const;

/** Animation period shrinks as traffic grows (log scale), so busier links visibly move faster. */
function flowDuration(rps: number): string {
  const s = Math.max(0.35, 2.2 - Math.log10(Math.max(1, rps)) * 0.45);
  return `${s.toFixed(2)}s`;
}

function FlowEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<FlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const rps = data?.rps;
  const active = rps !== undefined && rps > 0.0001;
  const color = STATUS_STROKE[data?.targetStatus ?? "idle"];

  if (data?.deploy) {
    return (
      <>
        <BaseEdge
          id={id}
          path={path}
          markerEnd={markerEnd}
          style={{ stroke: selected ? "var(--ring)" : "var(--brand-violet)", strokeWidth: selected ? 2 : 1.5, strokeDasharray: "6 5", opacity: 0.8 }}
        />
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-md border border-brand-violet/30 bg-background/90 px-1.5 py-0.5 text-[10px] text-brand-violet"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            deploy
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: selected ? "var(--ring)" : active ? color : "oklch(1 0 0 / 22%)",
          strokeWidth: selected ? 2.25 : active ? 1.75 : 1.5,
          opacity: rps === 0 ? 0.35 : 1,
        }}
      />
      {active && (
        <path
          d={path}
          fill="none"
          className="syslab-flow pointer-events-none"
          style={{ stroke: color, ["--flow-speed" as string]: flowDuration(rps) }}
        />
      )}
      {rps !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-md border border-border bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {fmtRps(rps)} rps
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const FlowEdgeComponent = memo(FlowEdgeView);
