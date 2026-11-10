"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, Position, getBezierPath, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
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

/**
 * Floating attachment: a link leaves and enters on whichever sides of the two nodes face each other,
 * so links to a node below or behind route cleanly instead of looping back from the right handle.
 */
function side(a: InternalNode, b: InternalNode): { x: number; y: number; pos: Position } {
  const aw = a.measured.width ?? 0;
  const ah = a.measured.height ?? 0;
  const bw = b.measured.width ?? 0;
  const bh = b.measured.height ?? 0;
  const ax = a.internals.positionAbsolute.x + aw / 2;
  const ay = a.internals.positionAbsolute.y + ah / 2;
  const bx = b.internals.positionAbsolute.x + bw / 2;
  const by = b.internals.positionAbsolute.y + bh / 2;
  const dx = bx - ax;
  const dy = by - ay;
  // Prefer left/right (the natural reading direction) unless the other node is clearly above or below.
  if (Math.abs(dx) - (aw + bw) / 4 >= Math.abs(dy)) {
    return dx > 0 ? { x: ax + aw / 2, y: ay, pos: Position.Right } : { x: ax - aw / 2, y: ay, pos: Position.Left };
  }
  return dy > 0 ? { x: ax, y: ay + ah / 2, pos: Position.Bottom } : { x: ax, y: ay - ah / 2, pos: Position.Top };
}

function FlowEdgeView({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<FlowEdge>) {
  const sNode = useInternalNode(source);
  const tNode = useInternalNode(target);
  let geo = { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition };
  if (sNode?.measured.width && tNode?.measured.width) {
    const s = side(sNode, tNode);
    const t = side(tNode, sNode);
    geo = { sourceX: s.x, sourceY: s.y, sourcePosition: s.pos, targetX: t.x, targetY: t.y, targetPosition: t.pos };
  }
  const [path, labelX, labelY] = getBezierPath({ ...geo, curvature: 0.3 });
  // A label needs room; on short links the nodes' own rps readout already says it.
  const roomy = Math.hypot(geo.targetX - geo.sourceX, geo.targetY - geo.sourceY) > 110;
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
          stroke: selected ? "var(--ring)" : active ? color : "color-mix(in oklch, var(--ink) 22%, transparent)",
          strokeWidth: selected ? 2.25 : active ? 1.75 : 1.5,
          opacity: rps === 0 ? 0.35 : 1,
        }}
      />
      {active && (
        <path
          d={path}
          fill="none"
          className="syslab-flow pointer-events-none"
          style={{ stroke: data?.targetStatus === "crit" ? "var(--brand-cyan)" : color, ["--flow-speed" as string]: flowDuration(rps) }}
        />
      )}
      {/* Into an overloaded component, some of the particles are failures. */}
      {active && data?.targetStatus === "crit" && (
        <path
          d={path}
          fill="none"
          className="syslab-flow pointer-events-none"
          style={{ stroke: "var(--status-crit)", animationDelay: "calc(var(--flow-speed) / -2)", ["--flow-speed" as string]: flowDuration(rps) }}
        />
      )}
      {rps !== undefined && (roomy || selected) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-full border border-border bg-popover px-2 py-0.5 font-mono text-[10px] text-foreground/80 shadow-sm"
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
