"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG, isKindAllowed, type NodeKind, type Vendor } from "@/lib/sim";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PALETTE_GROUPS, type PaletteGroup } from "./kind-style";
import { KindIcon } from "./kind-icon";

export const DRAG_MIME = "application/x-syslab-kind";

/**
 * Component palette: a category rail on the left and a dense tile grid for the active category.
 * Every category fits on one screen; search looks across all of them.
 */
export function Palette({ allowed, onAdd }: { allowed?: NodeKind[]; onAdd: (kind: NodeKind) => void }) {
  const allowedSet = useMemo(() => (allowed ? new Set(allowed) : null), [allowed]);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  // Only show what this challenge allows (custom is always offered).
  const groups = useMemo(
    () =>
      PALETTE_GROUPS.map((g) => {
        const ok = (k: NodeKind) => !allowedSet || isKindAllowed(k, allowedSet);
        return { ...g, generic: g.generic.filter(ok), services: g.services.filter(ok) };
      }).filter((g) => g.generic.length + g.services.length > 0),
    [allowedSet],
  );
  const [active, setActive] = useState(groups[0]?.title ?? "");
  const current = groups.find((g) => g.title === active) ?? groups[0];

  const matches = (k: NodeKind) => {
    const s = CATALOG[k];
    return [s.label, s.short, s.vendor ?? "", CATALOG[s.behavior].label, k].some((t) => t.toLowerCase().includes(q));
  };
  const results = q ? groups.map((g) => ({ ...g, generic: g.generic.filter(matches), services: g.services.filter(matches) })).filter((g) => g.generic.length + g.services.length > 0) : [];

  return (
    <div className="flex h-full min-h-0" aria-label="Component palette">
      {/* Category rail */}
      <nav aria-label="Component categories" className="flex w-[66px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border/70 bg-background/30 py-2">
        {groups.map((g) => {
          const Icon = g.icon;
          const on = !q && g.title === current?.title;
          return (
            <button
              key={g.title}
              type="button"
              onClick={() => {
                setActive(g.title);
                setQuery("");
              }}
              aria-current={on ? "true" : undefined}
              className={cn(
                "relative mx-1 flex flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[10px] font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                on ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {on && <span className="absolute -left-1 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-blue" aria-hidden="true" />}
              <Icon className="size-4" aria-hidden="true" />
              <span className="max-w-full truncate">{g.title}</span>
            </button>
          );
        })}
      </nav>

      {/* Tiles */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="space-y-1.5 border-b border-border/70 p-2">
          <label className="relative block">
            <span className="sr-only">Search components</span>
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all: kafka, aws, claude…"
              className="h-8 w-full rounded-lg border border-input bg-background/40 pl-7 pr-7 text-[12.5px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </label>
          <p className="px-0.5 text-[10px] text-muted-foreground">Drag onto the canvas or click to add.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {q ? (
            results.length === 0 ? (
              <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">No components match &ldquo;{query}&rdquo;.</p>
            ) : (
              <div className="space-y-3">
                {results.map((g) => (
                  <TileSection key={g.title} title={g.title} kinds={[...g.generic, ...g.services]} onAdd={onAdd} />
                ))}
              </div>
            )
          ) : (
            current && <GroupTiles group={current} onAdd={onAdd} />
          )}
        </div>
      </div>
    </div>
  );
}

function GroupTiles({ group, onAdd }: { group: PaletteGroup; onAdd: (kind: NodeKind) => void }) {
  return (
    <div className="space-y-3">
      <TileSection title={group.services.length > 0 ? "Building blocks" : group.title} kinds={group.generic} onAdd={onAdd} />
      {group.services.length > 0 && <TileSection title="Popular services" kinds={group.services} onAdd={onAdd} />}
    </div>
  );
}

function TileSection({ title, kinds, onAdd }: { title: string; kinds: NodeKind[]; onAdd: (kind: NodeKind) => void }) {
  if (kinds.length === 0) return null;
  return (
    <section className="space-y-1">
      <h3 className="px-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
      <ul className="grid grid-cols-3 gap-1">
        {kinds.map((k) => (
          <Tile key={k} kind={k} onAdd={onAdd} />
        ))}
      </ul>
    </section>
  );
}

function Tile({ kind, onAdd }: { kind: NodeKind; onAdd: (kind: NodeKind) => void }) {
  const spec = CATALOG[kind];
  return (
    <li>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, kind);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(kind)}
              aria-label={`Add ${spec.label}: ${spec.short}`}
              className={cn(
                "relative flex h-[70px] w-full cursor-grab flex-col items-center justify-center gap-1 rounded-lg border border-border/60 bg-card/40 px-1 pb-1 pt-1.5 text-center outline-none transition-colors",
                "hover:border-ring/60 hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                kind === "custom" && "border-dashed",
              )}
            />
          }
        >
          {spec.vendor && <VendorMark vendor={spec.vendor} />}
          <KindIcon kind={kind} size="md" />
          <span className="line-clamp-2 w-full overflow-hidden px-0.5 pb-px text-[10.5px] font-medium leading-[1.25] [overflow-wrap:normal] [word-break:normal]">{tileName(kind)}</span>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-72 p-0">
          <ComponentCard kind={kind} />
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

/** Hover card: what the component is, its defaults, and how the simulator treats it. Stacked vertically. */
function ComponentCard({ kind }: { kind: NodeKind }) {
  const spec = CATALOG[kind];
  const d = spec.defaults;
  const stats = [
    !spec.unlimited && d.capacity > 0 ? `${d.capacity.toLocaleString("en-US")} rps / replica` : null,
    d.latencyMs > 0 ? `${d.latencyMs} ms` : null,
    d.costPerReplica > 0 ? `$${d.costPerReplica}/mo` : "free",
  ].filter(Boolean);
  return (
    <div className="flex w-72 max-w-full flex-col gap-1.5 p-3 text-left">
      <div className="flex items-center gap-2">
        {/* The hover card is light; keep the icon on a dark chip so white marks (OpenAI, GitHub) stay visible. */}
        <span className="rounded-lg bg-neutral-900 p-0.5">
          <KindIcon kind={kind} size="sm" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold leading-tight">{spec.label}</span>
          <span className="block truncate text-[11px] opacity-70">{spec.short}</span>
        </span>
        {spec.vendor && (
          <span className="shrink-0 rounded border border-current/20 px-1 py-px text-[9px] font-semibold uppercase opacity-70">
            {VENDOR_STYLE[spec.vendor].text}
          </span>
        )}
      </div>
      <p className="text-[11.5px] leading-relaxed opacity-85">{spec.description}</p>
      <p className="font-mono text-[10.5px] opacity-70">{stats.join(" · ")}</p>
      {kind !== spec.behavior && (
        <p className="border-t border-current/15 pt-1.5 text-[10.5px] opacity-70">
          Simulated as <span className="font-semibold">{CATALOG[spec.behavior].label}</span>
          {spec.inherentlyRedundant && !CATALOG[spec.behavior].inherentlyRedundant ? " · managed, never a single point of failure" : ""}
        </p>
      )}
    </div>
  );
}

/** Tiles are narrow: short names for long labels (full name is in the hover card). */
const TILE_NAMES: Partial<Record<NodeKind, string>> = {
  serverless: "Serverless",
  worker: "Worker",
  websocketGateway: "WS Gateway",
  timeseriesDb: "Time-Series DB",
  objectStorage: "Object Storage",
  codeRepo: "Code Repo",
  ciPipeline: "CI/CD",
  containerRegistry: "Registry",
  fineTune: "Fine-tune Job",
  kubernetes: "Kubernetes",
  embeddings: "Embed API",
  vercelAiGateway: "AI Gateway",
  vercel: "Vercel",
  vercelSandbox: "Vercel Sandbox",
  cloudflareWorkers: "CF Workers",
  agentService: "AI Agent",
  pgvector: "pgvector",
  playwright: "Playwright",
  huggingface: "HF Inference",
  huggingfaceHub: "HF Hub",
  openaiFineTune: "OpenAI Fine-tune",
  awsApiGateway: "API Gateway",
  mongodbAtlas: "Atlas",
  prometheus: "Prometheus",
  githubActions: "Actions",
  e2b: "E2B",
  celery: "Celery",
  rabbitmq: "RabbitMQ",
  redisPubsub: "Redis Pub/Sub",
  redisStreams: "Redis Streams",
  sse: "SSE Stream",
};

function tileName(kind: NodeKind): string {
  return TILE_NAMES[kind] ?? CATALOG[kind].label.replace(/^(AWS|Google|Apache|Anthropic|OpenAI) (?=\S)/, "");
}

const VENDOR_STYLE: Record<Vendor, { text: string; cls: string }> = {
  AWS: { text: "AWS", cls: "text-status-warn" },
  GCP: { text: "GCP", cls: "text-brand-blue" },
  "Open source": { text: "OSS", cls: "text-status-ok" },
  SaaS: { text: "SaaS", cls: "text-brand-violet" },
};

function VendorMark({ vendor }: { vendor: Vendor }) {
  const v = VENDOR_STYLE[vendor];
  return <span className={cn("absolute right-1 top-0.5 text-[7.5px] font-semibold uppercase tracking-wide opacity-80", v.cls)}>{v.text}</span>;
}
