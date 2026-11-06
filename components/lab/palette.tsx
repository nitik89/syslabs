"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG, type NodeKind } from "@/lib/sim";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { KIND_ACCENT, KIND_ICON, PALETTE_GROUPS } from "./kind-style";

export const DRAG_MIME = "application/x-syslab-kind";

export function Palette({ allowed, onAdd }: { allowed?: NodeKind[]; onAdd: (kind: NodeKind) => void }) {
  const allowedSet = allowed ? new Set(allowed) : null;
  return (
    <div className="flex flex-col gap-4" aria-label="Component palette">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Drag onto the canvas, or press <kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to add at the center.
      </p>
      {PALETTE_GROUPS.map((group) => {
        const kinds = group.kinds.filter((k) => !allowedSet || allowedSet.has(k));
        if (kinds.length === 0) return null;
        return (
          <section key={group.title} className="space-y-1.5">
            <h3 className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</h3>
            <ul className="space-y-1">
              {kinds.map((kind) => {
                const spec = CATALOG[kind];
                const Icon = KIND_ICON[kind];
                return (
                  <li key={kind}>
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
                              "group flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left outline-none transition-colors",
                              "hover:border-border hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                            )}
                          />
                        }
                      >
                        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", KIND_ACCENT[kind])}>
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{spec.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{spec.short}</span>
                        </span>
                        <Plus className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-64">
                        <p className="font-medium">{spec.label}</p>
                        <p className="mt-1 opacity-80">{spec.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
