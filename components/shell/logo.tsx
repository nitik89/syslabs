"use client";

import { useId } from "react";
import Link from "next/link";

/** Original SysLab mark: three stacked nodes joined by a flow line. */
export function Logo({ compact = false }: { compact?: boolean }) {
  // Unique per instance: a gradient defined inside a hidden SVG (e.g. the desktop sidebar on mobile) is not resolvable.
  const gid = `syslab-g-${useId().replace(/:/g, "")}`;
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="SysLab home"
    >
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand-cyan)" />
            <stop offset="0.5" stopColor="var(--brand-blue)" />
            <stop offset="1" stopColor="var(--brand-violet)" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="8" fill="oklch(0.18 0.02 270)" stroke={`url(#${gid})`} strokeWidth="1.5" />
        <path d="M9 10.5 L16 16 L23 10.5 M16 16 V22.5" stroke={`url(#${gid})`} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <circle cx="9" cy="10.5" r="2.6" fill="var(--brand-cyan)" />
        <circle cx="23" cy="10.5" r="2.6" fill="var(--brand-violet)" />
        <circle cx="16" cy="22.5" r="2.6" fill="var(--brand-blue)" />
      </svg>
      {!compact && (
        <span className="text-[15px] font-semibold tracking-tight">
          Sys<span className="text-gradient-brand">Lab</span>
        </span>
      )}
    </Link>
  );
}
