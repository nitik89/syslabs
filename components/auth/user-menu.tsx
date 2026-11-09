"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, Settings, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "./auth-provider";

export function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from many OAuth hosts
    <img src={url} alt="" className={cn("size-7 rounded-full object-cover", className)} referrerPolicy="no-referrer" />
  ) : (
    <span className={cn("flex size-7 items-center justify-center rounded-full bg-brand-blue font-mono text-[11px] font-bold text-white", className)}>{initials}</span>
  );
}

/** Top-bar account control: Sign in for guests, an avatar menu for signed-in users. Hidden when accounts aren't configured. */
export function UserMenu() {
  const { enabled, loading, user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  if (!enabled) return null;
  if (loading) return <span className="size-7 animate-pulse rounded-full bg-white/[0.06]" aria-label="Loading account" />;
  if (!user) {
    return (
      <Link href="/login" className={cn(buttonVariants({ size: "sm" }), "h-7 px-3 text-xs")}>
        <LogIn /> Sign in
      </Link>
    );
  }

  const name = profile?.display_name || profile?.username || user.email || "You";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar name={name} url={profile?.avatar_url} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-[0_16px_40px_-12px_black]">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-[13px] font-semibold">{name}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">{profile ? `@${profile.username}` : user.email}</p>
          </div>
          {profile && (
            <Link role="menuitem" href={`/u/${profile.username}`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-white/[0.05]">
              <UserRound className="size-4 text-muted-foreground" /> Public profile
            </Link>
          )}
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-[13px] hover:bg-white/[0.05]">
            <Settings className="size-4 text-muted-foreground" /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={() => void signOut()} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] hover:bg-white/[0.05]">
            <LogOut className="size-4 text-muted-foreground" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
