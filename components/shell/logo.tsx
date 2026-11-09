"use client";

import Link from "next/link";

/** SysLab mark: a request's path drawn as an "S", from one node to the next, on a solid tile. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0`} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--brand-blue)" />
      <path d="M10.5 8.5H19.5a3.75 3.75 0 0 1 0 7.5H12.5a3.75 3.75 0 0 0 0 7.5H21.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="10" cy="8.5" r="2.6" fill="var(--brand-blue)" stroke="white" strokeWidth="2" />
      <circle cx="22" cy="23.5" r="2.9" fill="white" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="SysLab home">
      <LogoMark />
      {!compact && (
        <span className="text-[15.5px] font-semibold tracking-tight">
          Sys<span className="text-brand-blue">Lab</span>
        </span>
      )}
    </Link>
  );
}
