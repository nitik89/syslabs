"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronsLeft, GripVertical, Plus, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG, isKindAllowed, type NodeKind, type Vendor } from "@/lib/sim";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PALETTE_GROUPS } from "./kind-style";
import { KindIcon } from "./kind-icon";

export const DRAG_MIME = "application/x-syslab-kind";

/**
 * Component palette: title bar, search, then every category as a collapsible group (generic blocks, then named services).
 * Search looks across every category.
 */
export function Palette({ allowed, onAdd, onClose }: { allowed?: NodeKind[]; onAdd: (kind: NodeKind) => void; onClose?: () => void }) {
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
  const total = groups.reduce((n, g) => n + g.generic.length + g.services.length, 0);
  // Small palettes (challenges) start fully open; the full catalog starts with just the first group.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const defaultOpen = (title: string) => total <= 40 || title === groups[0]?.title;

  const matches = (k: NodeKind) => {
    const s = CATALOG[k];
    return [s.label, s.short, s.vendor ?? "", CATALOG[s.behavior].label, k].some((t) => t.toLowerCase().includes(q));
  };
  const results = q ? groups.map((g) => ({ ...g, generic: g.generic.filter(matches), services: g.services.filter(matches) })).filter((g) => g.generic.length + g.services.length > 0) : [];

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label="Component palette">
      <div className="space-y-3 border-b border-border px-3 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold">Components</h2>
          <span className="rounded-full bg-white/[0.06] px-1.5 font-mono text-[10.5px] text-muted-foreground">{total}</span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide components panel"
              title="Hide components panel"
              className="ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronsLeft className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <label className="relative block">
          <span className="sr-only">Search components</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Kafka, AWS, Claude…"
            className="h-8 w-full rounded-lg border border-input bg-white/[0.03] pl-8 pr-7 text-[12.5px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-search-cancel-button]:hidden"
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {q && results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-muted-foreground">No components match &ldquo;{query}&rdquo;.</p>
        ) : (
          (q ? results : groups).map((g) => (
            <GroupSection
              key={g.title}
              title={g.title}
              icon={g.icon}
              generic={g.generic}
              services={g.services}
              open={q ? true : (openGroups[g.title] ?? defaultOpen(g.title))}
              onToggle={() => setOpenGroups((o) => ({ ...o, [g.title]: !(o[g.title] ?? defaultOpen(g.title)) }))}
              onAdd={onAdd}
            />
          ))
        )}
      </div>

      <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <GripVertical className="size-3.5" aria-hidden="true" /> Drag onto the canvas, or click to add. Hover for details.
      </p>
    </div>
  );
}

function GroupSection({
  title,
  icon: Icon,
  generic,
  services,
  open,
  onToggle,
  onAdd,
}: {
  title: string;
  icon: LucideIcon;
  generic: NodeKind[];
  services: NodeKind[];
  open: boolean;
  onToggle: () => void;
  onAdd: (kind: NodeKind) => void;
}) {
  return (
    <section className="border-b border-border/70">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${title} components`}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04]"
      >
        <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden="true" />
        <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
        <span className="rounded bg-white/[0.06] px-1.5 font-mono text-[10px] text-muted-foreground">{generic.length + services.length}</span>
      </button>
      {open && (
        <div className="space-y-1 px-1.5 pb-2.5">
          {generic.length > 0 && (
            <ul className="space-y-px">
              {generic.map((k) => (
                <Item key={k} kind={k} onAdd={onAdd} />
              ))}
            </ul>
          )}
          {services.length > 0 && (
            <>
              {generic.length > 0 && <p className="px-2 pt-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/60">Services</p>}
              <ul className="space-y-px">
                {services.map((k) => (
                  <Item key={k} kind={k} onAdd={onAdd} />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Item({ kind, onAdd }: { kind: NodeKind; onAdd: (kind: NodeKind) => void }) {
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
              className="group/item flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            />
          }
        >
          <KindIcon kind={kind} size="sm" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{spec.label}</span>
          {spec.vendor ? (
            <VendorMark vendor={spec.vendor} />
          ) : (
            <Plus className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100" aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="max-w-72 p-0">
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
      {spec.includes && (
        <ul className="flex flex-wrap gap-1" aria-label="Built-in features">
          {spec.includes.map((f) => (
            <li key={f} className="rounded border border-current/20 px-1.5 py-px text-[10px] font-medium opacity-80">
              {f}
            </li>
          ))}
        </ul>
      )}
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

const VENDOR_STYLE: Record<Vendor, { text: string; cls: string }> = {
  AWS: { text: "AWS", cls: "text-status-warn" },
  GCP: { text: "GCP", cls: "text-brand-blue" },
  "Open source": { text: "OSS", cls: "text-status-ok" },
  SaaS: { text: "SaaS", cls: "text-brand-violet" },
};

function VendorMark({ vendor }: { vendor: Vendor }) {
  const v = VENDOR_STYLE[vendor];
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-current/25", v.cls)}>{v.text}</span>
  );
}
