"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** What a layout asks the workspace for. The designer listens for `syslab:layout` with the designer parts. */
export interface LayoutPreset {
  id: string;
  label: string;
  blurb: string;
  problem: boolean;
  /** Problem panel width in px (null = default). */
  problemWidth: number | null;
  settings: boolean;
  components: boolean;
  console: "open" | "closed";
  /** Mini picture: [problem, components, canvas, settings] column weights (0 = hidden); `low` = tall console. */
  shape: { cols: [number, number, number, number]; low: boolean };
}

export const LAYOUTS: LayoutPreset[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "Brief on the left, canvas in the middle, settings on the right.",
    problem: true,
    problemWidth: null,
    settings: true,
    components: false,
    console: "closed",
    shape: { cols: [3, 0, 6, 3], low: false },
  },
  {
    id: "focus",
    label: "Focus",
    blurb: "Just the canvas. Everything else tucked away.",
    problem: false,
    problemWidth: null,
    settings: false,
    components: false,
    console: "closed",
    shape: { cols: [0, 0, 12, 0], low: false },
  },
  {
    id: "read",
    label: "Read first",
    blurb: "A wide brief beside the canvas, for working through the problem.",
    problem: true,
    problemWidth: 480,
    settings: false,
    components: false,
    console: "closed",
    shape: { cols: [5, 0, 7, 0], low: false },
  },
  {
    id: "build",
    label: "Build",
    blurb: "Components and settings open around the canvas, brief hidden.",
    problem: false,
    problemWidth: null,
    settings: true,
    components: true,
    console: "closed",
    shape: { cols: [0, 3, 6, 3], low: false },
  },
  {
    id: "debug",
    label: "Debug",
    blurb: "Canvas with the run console open below, to watch every second.",
    problem: true,
    problemWidth: null,
    settings: false,
    components: false,
    console: "open",
    shape: { cols: [3, 0, 9, 0], low: true },
  },
];

const KEY = "syslab:layout";

export function savedLayout(): LayoutPreset | null {
  try {
    const id = localStorage.getItem(KEY);
    return LAYOUTS.find((l) => l.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Tell the designer which of its panels to show. */
export function applyDesignerLayout(l: LayoutPreset) {
  window.dispatchEvent(new CustomEvent("syslab:layout", { detail: { settings: l.settings, components: l.components, console: l.console } }));
}

function Mini({ shape, active }: { shape: LayoutPreset["shape"]; active: boolean }) {
  const [p, c, canvas, s] = shape.cols;
  const box = (w: number, cls: string) => (w > 0 ? <span className={cn("rounded-[2px]", cls)} style={{ flexGrow: w }} /> : null);
  return (
    <span
      className={cn("flex h-8 w-12 shrink-0 gap-[2px] rounded-md border p-[3px]", active ? "border-brand-blue/50 bg-brand-blue/[0.06]" : "border-border bg-white/[0.02]")}
      aria-hidden="true"
    >
      {box(p, "bg-muted-foreground/35")}
      {box(c, "bg-muted-foreground/25")}
      <span className="flex flex-col gap-[2px]" style={{ flexGrow: canvas }}>
        <span className={cn("flex-1 rounded-[2px]", active ? "bg-brand-blue/45" : "bg-muted-foreground/15")} />
        <span className={cn("rounded-[2px] bg-muted-foreground/30", shape.low ? "h-[40%]" : "h-[3px]")} />
      </span>
      {box(s, "bg-muted-foreground/25")}
    </span>
  );
}

/** The workspace's Layout button: a menu of arrangements, remembered between visits. */
export function LayoutMenu({ value, onChange }: { value: string; onChange: (l: LayoutPreset) => void }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open || !root.current || !menu.current) return;
    const b = root.current.getBoundingClientRect();
    const w = menu.current.offsetWidth;
    setShift(Math.min(0, window.innerWidth - 12 - (b.left + w)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        title="Arrange the workspace"
      >
        <PanelLeft /> Layout <ChevronDown className="size-3.5 opacity-60" />
      </Button>
      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="Workspace layout"
          style={{ transform: `translateX(${shift}px)` }}
          className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-xl border border-border bg-popover p-1.5 shadow-[0_16px_40px_-12px_var(--shadow)]"
        >
          {LAYOUTS.map((l) => {
            const on = l.id === value;
            return (
              <button
                key={l.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  onChange(l);
                  try {
                    localStorage.setItem(KEY, l.id);
                  } catch {
                    /* private mode: fine */
                  }
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06]",
                  on && "bg-white/[0.05]",
                )}
              >
                <Mini shape={l.shape} active={on} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{l.label}</span>
                  <span className="block text-[11.5px] leading-snug text-muted-foreground">{l.blurb}</span>
                </span>
                {on && <Check className="size-3.5 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
