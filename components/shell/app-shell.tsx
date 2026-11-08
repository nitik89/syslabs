"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame, Menu, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import { PROGRESS_EVENT, currentStreak, getRepo, levelOf, type ProgressState } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Logo } from "./logo";
import { CommandMenu } from "./command-menu";
import { NAV_ITEMS, isActive, isWorkspace, type NavItem } from "./nav";

const TOTAL = CHALLENGES.length + DESIGNS.length;

/** Progress for the sidebar badges; refreshed on navigation and whenever an attempt is recorded. */
function useShellProgress(pathname: string): ProgressState | null {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      getRepo()
        .getProgress()
        .then((p) => !cancelled && setProgress(p), () => {});
    load();
    window.addEventListener(PROGRESS_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(PROGRESS_EVENT, load);
    };
  }, [pathname]);
  return progress;
}

function countFor(item: NavItem, p: ProgressState | null): string | null {
  if (!p) return null;
  const list = item.href === "/challenges" ? CHALLENGES : item.href === "/build" ? DESIGNS : null;
  if (!list) return null;
  return `${list.filter((c) => p.challenges[c.id]?.passed).length}/${list.length}`;
}

function NavLinks({ onNavigate, progress, rail = false }: { onNavigate?: () => void; progress: ProgressState | null; rail?: boolean }) {
  const pathname = usePathname();
  const sections = ["Practice", "Workspace"] as const;
  return (
    <nav aria-label="Main" className={cn("flex flex-col", rail ? "items-center gap-1.5" : "gap-0.5")}>
      {sections.map((section) => (
        <div key={section} className={cn("flex flex-col", rail ? "items-center gap-1.5" : "gap-0.5")}>
          {rail ? (
            section !== "Practice" && <span className="my-1.5 h-px w-6 bg-sidebar-border" aria-hidden="true" />
          ) : (
            <p className="px-3 pb-1.5 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">{section}</p>
          )}
          {NAV_ITEMS.filter((i) => i.section === section).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const count = countFor(item, progress);
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                aria-label={rail ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  rail ? "size-10 justify-center" : "gap-3 px-3 py-2",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-inset ring-brand-blue/25"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-sidebar-foreground",
                )}
              >
                <Icon className={cn("size-[17px] shrink-0", active && "text-brand-blue")} aria-hidden="true" />
                {!rail && (
                  <>
                    <span className="font-medium">{item.label}</span>
                    {count && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{count}</span>}
                  </>
                )}
              </Link>
            );
            return rail ? (
              <Tooltip key={item.href}>
                <TooltipTrigger render={link} />
                <TooltipContent side="right">
                  {item.label}
                  {count && <span className="ml-1.5 font-mono opacity-70">{count}</span>}
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function LevelCard({ progress, rail = false }: { progress: ProgressState | null; rail?: boolean }) {
  const xp = progress?.xp ?? 0;
  const { level, into, toNext } = levelOf(xp);
  const pct = Math.round((into / (into + toNext)) * 100);
  if (rail) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href="/progress"
              aria-label={`Level ${level}, ${xp} XP`}
              className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet font-mono text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          L{level}
        </TooltipTrigger>
        <TooltipContent side="right">
          Level {level} · {xp.toLocaleString()} XP
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Link
      href="/progress"
      className="surface flex items-center gap-3 rounded-xl p-3 outline-none transition-colors hover:border-brand-blue/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan via-brand-blue to-brand-violet font-mono text-xs font-bold text-white">
        L{level}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-baseline justify-between text-xs">
          <span className="font-medium">Level {level}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{xp.toLocaleString()} XP</span>
        </span>
        <span className="block h-1 overflow-hidden rounded-full bg-white/[0.07]">
          <span className="block h-full rounded-full bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-violet" style={{ width: `${pct}%` }} />
        </span>
        <span className="block text-[10.5px] text-muted-foreground">{toNext} XP to level {level + 1}</span>
      </span>
    </Link>
  );
}

/** Always-visible stats: streak, XP and problems solved. */
function StatsBar({ progress }: { progress: ProgressState | null }) {
  const pathname = usePathname();
  const here = NAV_ITEMS.find((i) => isActive(pathname, i.href));
  const streak = progress ? currentStreak(progress.activeDays, new Date()) : 0;
  const solved = progress ? Object.values(progress.challenges).filter((r) => r.passed).length : 0;
  const xp = progress?.xp ?? 0;
  const { level } = levelOf(xp);
  const chip = "flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs ring-1 ring-inset ring-border bg-white/[0.03]";
  const value = (v: string | number) => <span className="font-mono font-semibold text-foreground">{progress ? v : "–"}</span>;
  return (
    <div className="flex h-12 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <span className="hidden shrink-0 text-[13px] font-medium text-foreground/90 lg:block">{here?.label ?? "SysLab"}</span>
      <span className="hidden h-4 w-px bg-border lg:block" aria-hidden="true" />
      <CommandMenu progress={progress} />
      <div className="ml-auto flex items-center gap-1.5 text-muted-foreground" aria-label="Your stats">
        <Link href="/progress" className={cn(chip, "outline-none transition-colors hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ring")} title="Days in a row you've run a simulation">
          <Flame className={cn("size-3.5", streak > 0 ? "text-status-warn" : "")} aria-hidden="true" />
          {value(streak)} <span className="hidden sm:inline">day streak</span>
        </Link>
        <Link href="/progress" className={cn(chip, "outline-none transition-colors hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ring")} title={`Level ${level}`}>
          <Sparkles className="size-3.5 text-brand-violet" aria-hidden="true" />
          {value(xp.toLocaleString())} XP
        </Link>
        <Link href="/progress" className={cn(chip, "outline-none transition-colors hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ring")} title="Challenges and build problems solved">
          <Trophy className="size-3.5 text-status-ok" aria-hidden="true" />
          {value(solved)}
          <span>/ {TOTAL}</span>
          <span className="hidden sm:inline">solved</span>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const rail = isWorkspace(pathname);
  const progress = useShellProgress(pathname);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar: full on browsing pages, an icon rail on design canvases. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
          rail ? "w-16 items-center gap-4 px-2 py-4" : "w-60 gap-2 p-4",
        )}
      >
        <div className={cn(rail ? "pb-2" : "px-2 pb-2 pt-1")}>
          <Logo compact={rail} />
        </div>
        <NavLinks progress={progress} rail={rail} />
        <div className="mt-auto space-y-3">
          <LevelCard progress={progress} rail={rail} />
          {!rail && <p className="px-1 text-[10.5px] leading-relaxed text-muted-foreground/70">Your data stays in this browser. All metrics are simulated.</p>}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar/90 px-4 backdrop-blur md:hidden">
          <Logo />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-2 bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="px-2 pb-2 pt-1">
                <Logo />
              </div>
              <NavLinks progress={progress} onNavigate={() => setMobileOpen(false)} />
              <div className="mt-auto">
                <LevelCard progress={progress} />
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className="sticky top-0 z-30 max-md:top-14">
          <StatsBar progress={progress} />
        </div>

        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
