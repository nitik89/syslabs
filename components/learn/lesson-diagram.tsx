import { Fragment } from "react";
import type { Diagram, DiagramEdge, DiagramNode, Tone } from "@/data/lesson-diagrams";

const TONE: Record<Tone, string> = {
  blue: "var(--brand-blue)",
  cyan: "var(--brand-cyan)",
  violet: "var(--brand-violet)",
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  crit: "var(--status-crit)",
  muted: "var(--muted-foreground)",
};

const DEFAULT_W = 124;
const DEFAULT_H = 44;

type Pt = { x: number; y: number };

function size(n: DiagramNode) {
  const w = n.w ?? (n.shape === "dot" ? 14 : n.shape === "circle" ? 46 : DEFAULT_W);
  const h = n.h ?? (n.shape === "dot" ? 14 : n.shape === "circle" ? 46 : n.sub ? DEFAULT_H + 6 : DEFAULT_H);
  return { w, h };
}

/** Where a line from the node's centre towards `toward` leaves its outline. */
function exitPoint(n: DiagramNode, toward: Pt): Pt {
  const { w, h } = size(n);
  const dx = toward.x - n.x;
  const dy = toward.y - n.y;
  const len = Math.hypot(dx, dy) || 1;
  if (n.shape === "circle" || n.shape === "dot") {
    const r = w / 2 + 2;
    return { x: n.x + (dx / len) * r, y: n.y + (dy / len) * r };
  }
  const hw = w / 2 + 3;
  const hh = h / 2 + 3;
  const t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  return { x: n.x + dx * t, y: n.y + dy * t };
}

function edgePath(e: DiagramEdge, a: DiagramNode, b: DiagramNode) {
  const bend = e.bend ?? 0;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Control point pushed sideways from the midpoint for curved links.
  const ctrl = { x: mid.x - (dy / len) * bend, y: mid.y + (dx / len) * bend };
  const start = exitPoint(a, bend ? ctrl : b);
  const end = exitPoint(b, bend ? ctrl : a);
  const d = bend ? `M${start.x},${start.y} Q${ctrl.x},${ctrl.y} ${end.x},${end.y}` : `M${start.x},${start.y} L${end.x},${end.y}`;
  // Label sits on the curve's midpoint (for a quadratic: average of the ends and the control point).
  const label = bend ? { x: (start.x + 2 * ctrl.x + end.x) / 4, y: (start.y + 2 * ctrl.y + end.y) / 4 } : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return { d, label };
}

function NodeShape({ n }: { n: DiagramNode }) {
  const { w, h } = size(n);
  const c = TONE[n.tone ?? "blue"];
  const fill = `color-mix(in oklch, ${c} ${n.solid ? 85 : 12}%, var(--card))`;
  const x = n.x - w / 2;
  const y = n.y - h / 2;
  const textColor = n.solid ? "var(--primary-foreground)" : "var(--foreground)";
  const shape = (() => {
    switch (n.shape) {
      case "db":
        return (
          <>
            <path d={`M${x},${y + 7} v${h - 14} a${w / 2},7 0 0 0 ${w},0 v${-(h - 14)}`} fill={fill} stroke={c} strokeWidth={1.5} />
            <ellipse cx={n.x} cy={y + 7} rx={w / 2} ry={7} fill={fill} stroke={c} strokeWidth={1.5} />
          </>
        );
      case "queue":
        return (
          <>
            <rect x={x} y={y} width={w} height={h} rx={8} fill={fill} stroke={c} strokeWidth={1.5} />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={x + w * f} x2={x + w * f} y1={y + 6} y2={y + h - 6} stroke={c} strokeOpacity={0.35} strokeWidth={1.2} />
            ))}
          </>
        );
      case "client":
        return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={c} strokeWidth={1.5} />;
      case "circle":
      case "dot":
        return <circle cx={n.x} cy={n.y} r={w / 2} fill={n.shape === "dot" ? c : fill} stroke={c} strokeWidth={1.5} />;
      default:
        return <rect x={x} y={y} width={w} height={h} rx={10} fill={fill} stroke={c} strokeWidth={n.emphasis ? 2.4 : 1.5} />;
    }
  })();
  if (n.shape === "dot") {
    return (
      <g>
        {shape}
        {n.label && (
          <text x={n.x} y={n.y + 22} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)" fontFamily="var(--font-geist-mono), monospace">
            {n.label}
          </text>
        )}
      </g>
    );
  }
  const labelY = n.sub ? n.y - 3 : n.y + 4.5;
  return (
    <g>
      {shape}
      <text x={n.x} y={labelY} textAnchor="middle" fontSize={13} fontWeight={600} fill={textColor}>
        {n.label}
      </text>
      {n.sub && (
        <text x={n.x} y={n.y + 13} textAnchor="middle" fontSize={10.5} fill={n.solid ? textColor : c} fontFamily="var(--font-geist-mono), monospace">
          {n.sub}
        </text>
      )}
    </g>
  );
}

/**
 * A lesson's 2D diagram: components, links (with moving requests where traffic flows), notes and
 * labelled zones for before/after comparisons. Colours come from the theme, so it works light and dark.
 */
export function LessonDiagram({ diagram, id }: { diagram: Diagram; id: string }) {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const tones = Array.from(new Set<Tone>(["muted", ...diagram.edges.map((e) => e.tone ?? "muted")]));
  return (
    <figure className="surface space-y-3 overflow-hidden rounded-2xl p-4">
      <div className="-mx-1 overflow-x-auto">
        <svg
          viewBox={`0 0 ${diagram.w} ${diagram.h}`}
          role="img"
          aria-labelledby={`${id}-cap`}
          className="mx-auto block h-auto w-full min-w-[560px]"
          style={{ maxWidth: diagram.w }}
        >
          <defs>
            {tones.map((t) => (
              <marker key={t} id={`${id}-arrow-${t}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={TONE[t]} />
              </marker>
            ))}
          </defs>

          {diagram.rings?.map((r, i) => (
            <circle key={i} cx={r.cx} cy={r.cy} r={r.r} fill="none" stroke="var(--border)" strokeWidth={10} />
          ))}

          {diagram.zones?.map((z) => {
            const c = TONE[z.tone ?? "muted"];
            return (
              <g key={z.label}>
                <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={14} fill={`color-mix(in oklch, ${c} 5%, transparent)`} stroke={c} strokeOpacity={0.45} strokeDasharray="5 5" />
                <text x={z.x + 12} y={z.y + 20} fontSize={11} fontWeight={700} letterSpacing={1.2} fill={c} fontFamily="var(--font-geist-mono), monospace">
                  {z.label.toUpperCase()}
                </text>
              </g>
            );
          })}

          {diagram.lines?.map((l, i) => (
            <g key={i}>
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={TONE[l.tone ?? "crit"]} strokeWidth={2} strokeDasharray="7 5" />
              {l.label && (
                <text x={l.x2} y={l.y2 + 16} textAnchor="middle" fontSize={11} fill={TONE[l.tone ?? "crit"]} fontFamily="var(--font-geist-mono), monospace">
                  {l.label}
                </text>
              )}
            </g>
          ))}

          {diagram.edges.map((e, i) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) return null;
            const tone = e.tone ?? "muted";
            const { d, label } = edgePath(e, a, b);
            const c = TONE[tone];
            return (
              <Fragment key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={c}
                  strokeOpacity={tone === "muted" ? 0.6 : 0.85}
                  strokeWidth={1.6}
                  strokeDasharray={e.dashed ? "6 5" : undefined}
                  markerEnd={e.noArrow ? undefined : `url(#${id}-arrow-${tone})`}
                  markerStart={e.both ? `url(#${id}-arrow-${tone})` : undefined}
                />
                {/* Requests moving along the link (hidden for reduced motion, see globals.css). */}
                {Array.from({ length: e.flow ?? 0 }, (_, k) => (
                  <circle key={k} r={3.6} fill={tone === "muted" ? "var(--brand-blue)" : c} className="diagram-flow">
                    <animateMotion dur={`${e.dur ?? 2.2}s`} repeatCount="indefinite" begin={`-${(k * (e.dur ?? 2.2)) / (e.flow ?? 1) + 0.01}s`} path={d} />
                  </circle>
                ))}
                {e.label && (
                  <g>
                    <rect
                      x={label.x - (e.label.length * 6.1) / 2 - 6}
                      y={label.y - 10}
                      width={e.label.length * 6.1 + 12}
                      height={19}
                      rx={6}
                      fill="var(--card)"
                      stroke="var(--border)"
                    />
                    <text x={label.x} y={label.y + 3.8} textAnchor="middle" fontSize={10.5} fill={tone === "muted" ? "var(--muted-foreground)" : c} fontFamily="var(--font-geist-mono), monospace">
                      {e.label}
                    </text>
                  </g>
                )}
              </Fragment>
            );
          })}

          {diagram.nodes.map((n) => (
            <NodeShape key={n.id} n={n} />
          ))}

          {diagram.notes?.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={t.y}
              textAnchor={t.anchor ?? "middle"}
              fontSize={t.size ?? 11.5}
              fontWeight={t.bold ? 600 : 400}
              fill={TONE[t.tone ?? "muted"]}
            >
              {t.text}
            </text>
          ))}
        </svg>
      </div>
      <figcaption id={`${id}-cap`} className="text-[13px] leading-relaxed text-muted-foreground">
        {diagram.caption}
      </figcaption>
    </figure>
  );
}
