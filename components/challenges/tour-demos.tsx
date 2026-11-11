/**
 * Small looping animations for the guided tour: each shows one gesture on a miniature canvas.
 * Pure SVG with SMIL animation, coloured from theme tokens; hidden for reduced motion (see globals.css).
 */

const T = {
  card: "var(--card)",
  border: "var(--border)",
  fg: "var(--foreground)",
  muted: "var(--muted-foreground)",
  blue: "var(--brand-blue)",
  cyan: "var(--brand-cyan)",
  ok: "var(--status-ok)",
  warn: "var(--status-warn)",
  crit: "var(--status-crit)",
};

const DUR = "4s";

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 300 130" role="img" aria-label={label} className="tour-demo h-auto w-full rounded-xl border border-border bg-background">
      <defs>
        <pattern id="tour-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill={T.muted} opacity="0.25" />
        </pattern>
      </defs>
      <rect width="300" height="130" fill="url(#tour-dots)" />
      {children}
    </svg>
  );
}

function Node({ x, y, label, sub, tone = T.blue, w = 92 }: { x: number; y: number; label: string; sub?: string; tone?: string; w?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height="34" rx="8" fill={T.card} stroke={tone} strokeWidth="1.4" />
      <text x="9" y={sub ? 15 : 21} fontSize="10.5" fontWeight="600" fill={T.fg}>
        {label}
      </text>
      {sub && (
        <text x="9" y="27" fontSize="8.5" fill={tone} fontFamily="monospace">
          {sub}
        </text>
      )}
    </g>
  );
}

/** A pointer that moves along `path` (relative to the frame) once per loop. */
function Cursor({ path, keyTimes = "0;0.25;0.65;1" , values }: { path?: string; keyTimes?: string; values: string }) {
  return (
    <g>
      <path d="M0,0 L0,13 L3.5,10 L6,15.5 L8,14.6 L5.6,9.4 L10,9.4 Z" fill={T.fg} stroke="var(--background)" strokeWidth="1" />
      <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" values={values} keyTimes={keyTimes} />
      {path && null}
    </g>
  );
}

/** Click "Redis Cache" in the list, or drag it onto the canvas: it appears on the canvas. */
export function AddDemo() {
  return (
    <Frame label="Drag Redis Cache from the list onto the canvas">
      {/* Mini palette */}
      <rect x="8" y="8" width="96" height="114" rx="8" fill={T.card} stroke={T.border} />
      <text x="16" y="24" fontSize="9" fontWeight="700" fill={T.muted}>
        COMPONENTS
      </text>
      {["Load Balancer", "Redis Cache", "SQL Database", "Queue"].map((n, i) => (
        <g key={n}>
          <rect x="14" y={32 + i * 21} width="84" height="17" rx="5" fill={i === 1 ? "color-mix(in oklch, var(--brand-cyan) 18%, transparent)" : "transparent"} />
          <text x="20" y={44 + i * 21} fontSize="9.5" fill={T.fg}>
            {n}
          </text>
        </g>
      ))}
      {/* The dragged card */}
      <g opacity="0">
        <Node x={0} y={0} label="Redis Cache" sub="cache" tone={T.cyan} />
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1;1" keyTimes="0;0.25;0.3;0.9;1" />
        <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" values="20,46; 20,46; 20,46; 170,48; 170,48" keyTimes="0;0.25;0.3;0.65;1" />
      </g>
      <Cursor values="150,110; 60,60; 60,60; 210,64; 210,64" keyTimes="0;0.25;0.3;0.65;1" />
      <text x="200" y="118" fontSize="9" fill={T.muted} textAnchor="middle">
        click, or drag onto the canvas
      </text>
    </Frame>
  );
}

/** Drag from Catalog API's right dot to Redis Cache's left dot: a connection appears. */
export function ConnectDemo() {
  return (
    <Frame label="Drag from one component's right dot to another's left dot to connect them">
      <Node x={18} y={46} label="Catalog API" sub="app server" />
      <Node x={186} y={46} label="Redis Cache" sub="cache" tone={T.cyan} />
      <circle cx="110" cy="63" r="4" fill={T.blue} />
      <circle cx="186" cy="63" r="4" fill={T.cyan} />
      <line x1="110" y1="63" x2="110" y2="63" stroke={T.blue} strokeWidth="2">
        <animate attributeName="x2" dur={DUR} repeatCount="indefinite" values="110;110;182;182;182" keyTimes="0;0.25;0.65;0.95;1" />
      </line>
      <Cursor values="150,110; 108,61; 182,61; 182,61; 182,61" keyTimes="0;0.25;0.65;0.95;1" />
      <text x="150" y="30" fontSize="9" fill={T.muted} textAnchor="middle">
        right dot → left dot
      </text>
      <text x="150" y="112" fontSize="9" fill={T.ok} textAnchor="middle" opacity="0">
        reads now go to the cache
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;0;1;1" keyTimes="0;0.25;0.65;0.7;1" />
      </text>
    </Frame>
  );
}

/** Double-click → Replicas 1 → 3: capacity triples and the component goes from red to green. */
export function ReplicasDemo() {
  return (
    <Frame label="Double-click a component and raise Replicas from 1 to 3 to triple its capacity">
      <g>
        <rect x="16" y="20" width="110" height="40" rx="8" fill={T.card} strokeWidth="1.6">
          <animate attributeName="stroke" dur={DUR} repeatCount="indefinite" values={`${T.crit};${T.crit};${T.ok};${T.ok}`} keyTimes="0;0.55;0.6;1" calcMode="discrete" />
        </rect>
        <text x="25" y="36" fontSize="10.5" fontWeight="600" fill={T.fg}>
          App Server
        </text>
        <text x="25" y="50" fontSize="8.5" fontFamily="monospace" fill={T.muted}>
          <tspan>
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.55;0.6;1" calcMode="discrete" />
            ×1 · 200% busy
          </tspan>
        </text>
        <text x="25" y="50" fontSize="8.5" fontFamily="monospace" fill={T.ok} opacity="0">
          ×3 · 67% busy
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.55;0.6;1" calcMode="discrete" />
        </text>
      </g>
      {/* Settings panel */}
      <g>
        <rect x="150" y="12" width="136" height="106" rx="8" fill={T.card} stroke={T.border} />
        <text x="160" y="30" fontSize="9" fontWeight="700" fill={T.muted}>
          COMPONENT SETTINGS
        </text>
        <text x="160" y="50" fontSize="9.5" fill={T.fg}>
          Replicas
        </text>
        <rect x="222" y="40" width="54" height="16" rx="4" fill="var(--background)" stroke={T.blue} />
        <text x="249" y="52" fontSize="10" fontFamily="monospace" textAnchor="middle" fill={T.fg}>
          <tspan>
            1
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.55;1" calcMode="discrete" />
          </tspan>
        </text>
        <text x="249" y="52" fontSize="10" fontFamily="monospace" textAnchor="middle" fill={T.blue} opacity="0">
          3
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.55;1" calcMode="discrete" />
        </text>
        <text x="160" y="78" fontSize="9" fill={T.muted}>
          Capacity
        </text>
        <text x="276" y="78" fontSize="9" fontFamily="monospace" textAnchor="end" fill={T.fg}>
          <tspan>
            1,500 rps
            <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.55;1" calcMode="discrete" />
          </tspan>
        </text>
        <text x="276" y="78" fontSize="9" fontFamily="monospace" textAnchor="end" fill={T.ok} opacity="0">
          4,500 rps
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.55;1" calcMode="discrete" />
        </text>
        <text x="160" y="104" fontSize="8.5" fill={T.muted}>
          + survives losing one server
        </text>
      </g>
      <Cursor values="60,100; 60,40; 60,40; 250,48; 250,48" keyTimes="0;0.2;0.35;0.5;1" />
    </Frame>
  );
}

/** Cache size 8 → 32 GB raises the hit ratio and takes load off the database. */
export function CacheDemo() {
  return (
    <Frame label="Raise cache size from 8 to 32 GB: the hit ratio goes up and the database gets less traffic">
      <Node x={14} y={18} label="Redis Cache" sub="cache size" tone={T.cyan} w={100} />
      <text x="96" y="45" fontSize="9" fontFamily="monospace" textAnchor="end" fill={T.cyan}>
        <tspan>
          8 GB
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.5;1" calcMode="discrete" />
        </tspan>
      </text>
      <text x="96" y="45" fontSize="9" fontFamily="monospace" textAnchor="end" fill={T.cyan} opacity="0">
        32 GB
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.45;0.5;1" calcMode="discrete" />
      </text>
      <Node x={14} y={78} label="SQL Database" sub="reads that miss" tone={T.ok} w={100} />
      {/* Hit ratio bar */}
      <text x="140" y="34" fontSize="9" fill={T.muted}>
        hit ratio
      </text>
      <rect x="140" y="40" width="140" height="10" rx="5" fill="color-mix(in oklch, var(--ink) 8%, transparent)" />
      <rect x="140" y="40" height="10" rx="5" fill={T.cyan} width="98">
        <animate attributeName="width" dur={DUR} repeatCount="indefinite" values="98;98;126;126" keyTimes="0;0.45;0.6;1" />
      </rect>
      <text x="140" y="72" fontSize="9" fill={T.muted}>
        database load
      </text>
      <rect x="140" y="78" width="140" height="10" rx="5" fill="color-mix(in oklch, var(--ink) 8%, transparent)" />
      <rect x="140" y="78" height="10" rx="5" width="84">
        <animate attributeName="width" dur={DUR} repeatCount="indefinite" values="84;84;28;28" keyTimes="0;0.45;0.6;1" />
        <animate attributeName="fill" dur={DUR} repeatCount="indefinite" values={`${T.warn};${T.warn};${T.ok};${T.ok}`} keyTimes="0;0.45;0.6;1" calcMode="discrete" />
      </rect>
      <text x="280" y="112" fontSize="8.5" fill={T.muted} textAnchor="end">
        bigger caches hold more hot items (and cost more)
      </text>
    </Frame>
  );
}

/** Move by dragging; Delete removes a selected component; double-clicking an arrow removes it. */
export function EditDemo() {
  return (
    <Frame label="Drag to move, press Delete to remove a selected component, double-click an arrow to remove it">
      <Node x={18} y={46} label="App Server" />
      <g>
        <Node x={186} y={46} label="Queue" tone={T.warn} />
        <animateTransform attributeName="transform" type="translate" dur={DUR} repeatCount="indefinite" values="0,0; 0,0; 0,-26; 0,-26; 0,-26" keyTimes="0;0.15;0.35;0.9;1" />
      </g>
      <line x1="110" y1="63" x2="186" y2="63" stroke={T.muted} strokeWidth="1.6">
        <animate attributeName="y2" dur={DUR} repeatCount="indefinite" values="63;63;37;37;37" keyTimes="0;0.15;0.35;0.9;1" />
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;1;0;0" keyTimes="0;0.15;0.62;0.66;1" calcMode="discrete" />
      </line>
      <Cursor values="230,64; 230,64; 230,38; 150,52; 150,52" keyTimes="0;0.15;0.35;0.55;1" />
      <text x="150" y="112" fontSize="9" textAnchor="middle" fill={T.muted}>
        <tspan>
          drag to move
          <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.45;0.5;1" calcMode="discrete" />
        </tspan>
      </text>
      <text x="150" y="112" fontSize="9" textAnchor="middle" fill={T.crit} opacity="0">
        double-click an arrow → removed (⌘Z undoes)
        <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.55;0.6;1" calcMode="discrete" />
      </text>
    </Frame>
  );
}
