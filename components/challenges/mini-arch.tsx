import { CATALOG, type SimGraph } from "@/lib/sim";
import type { DesignDoc } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { KindIcon } from "@/components/lab/kind-icon";

/** A small, static picture of a design: component icons where they sit on the canvas, joined by their links. */
export function MiniArch({
  graph,
  positions,
  className,
  labels = false,
}: {
  graph: SimGraph;
  positions: DesignDoc["positions"];
  className?: string;
  labels?: boolean;
}) {
  // Canvas positions are a node's top-left corner; use its centre.
  const pts = graph.nodes.map((n) => ({ id: n.id, x: (positions[n.id]?.x ?? 0) + 94, y: (positions[n.id]?.y ?? 0) + 30 }));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const at = new Map(
    pts.map((p) => [p.id, { x: maxX === minX ? 50 : ((p.x - minX) / (maxX - minX)) * 100, y: maxY === minY ? 50 : ((p.y - minY) / (maxY - minY)) * 100 }]),
  );

  if (graph.nodes.length <= 1) {
    // Blank canvas (build problems): users, then the part you design.
    const first = graph.nodes[0];
    return (
      <div className={cn("bg-dots flex items-center justify-center gap-3", className)} aria-hidden="true">
        {first && <KindIcon kind={first.kind} size="lg" />}
        <span className="h-px w-10 bg-gradient-to-r from-white/25 to-brand-violet/60" />
        <span className="flex h-8 items-center rounded-lg border border-dashed border-brand-violet/50 bg-brand-violet/5 px-3 font-mono text-[11px] text-brand-violet">
          your design
        </span>
      </div>
    );
  }

  return (
    <div className={cn("bg-dots relative", className)} aria-hidden="true">
      <div className="absolute inset-x-8 inset-y-6">
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
          {graph.edges.map((e) => {
            const a = at.get(e.source);
            const b = at.get(e.target);
            if (!a || !b) return null;
            return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ stroke: "color-mix(in oklch, var(--brand-blue) 50%, transparent)" }} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />;
          })}
        </svg>
        {graph.nodes.map((n) => {
          const p = at.get(n.id)!;
          return (
            <div key={n.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <KindIcon kind={n.kind} size={labels ? "md" : "sm"} className="shadow-[0_0_0_3px_var(--card)]" />
              {labels && <span className="whitespace-nowrap rounded bg-card/80 px-1 text-[10px] text-muted-foreground">{n.label?.trim() || CATALOG[n.kind].label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
