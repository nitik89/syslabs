"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

/** A panel width the user can change by dragging an edge. Returns the width (null = default) and handle props. */
export function usePanelWidth({ min, max }: { min: number; max: number }) {
  const [width, setWidth] = useState<number | null>(null);
  const clamp = useCallback((w: number) => Math.round(Math.min(Math.max(w, min), max)), [min, max]);
  return { width, setWidth: (w: number) => setWidth(clamp(w)), reset: () => setWidth(null) };
}

/**
 * Vertical drag handle on a panel's edge. `side` is which edge it sits on: "right" grows the panel when dragged right,
 * "left" grows it when dragged left. Arrow keys resize by 24px; double-click resets.
 */
export function ResizeHandle({
  label,
  side = "right",
  getWidth,
  onResize,
  onReset,
}: {
  label: string;
  side?: "left" | "right";
  getWidth: () => number;
  onResize: (w: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dir = side === "right" ? 1 : -1;
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = getWidth();
    setDragging(true);
    const move = (ev: PointerEvent) => onResize(startW + dir * (ev.clientX - startX));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setDragging(false);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        onResize(getWidth() + (e.key === "ArrowRight" ? 24 : -24) * dir);
      }}
      className={cn(
        "group absolute inset-y-0 z-20 hidden w-2 cursor-col-resize outline-none lg:block",
        side === "right" ? "-right-1" : "-left-1",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary",
          dragging && "w-0.5 bg-primary",
        )}
      />
    </div>
  );
}
