"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Search } from "lucide-react";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import type { ProgressState } from "@/lib/storage";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { NAV_ITEMS } from "./nav";

/** ⌘K / Ctrl+K: jump to any page, challenge or build problem. */
export function CommandMenu({ progress }: { progress: ProgressState | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href as Parameters<typeof router.push>[0]);
  };
  const mark = (id: string) =>
    progress?.challenges[id]?.passed ? (
      <CheckCircle2 className="text-status-ok" aria-label="Solved" />
    ) : (
      <Circle className="text-muted-foreground/50" aria-label="Not solved" />
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-72 items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 text-xs text-muted-foreground outline-none ring-1 ring-inset ring-border transition-colors hover:text-foreground hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="size-3.5" aria-hidden="true" />
        <span className="flex-1 text-left">Search problems and pages…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search SysLab" description="Jump to a page, challenge or build problem">
        <Command>
          <CommandInput placeholder="Search challenges, products, pages…" />
          <CommandList className="max-h-[min(60vh,420px)]">
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Pages">
              {NAV_ITEMS.map((i) => {
                const Icon = i.icon;
                return (
                  <CommandItem key={i.href} value={`page ${i.label}`} onSelect={() => go(i.href)}>
                    <Icon /> {i.label}
                    <CommandShortcut>{i.description}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Challenges">
              {CHALLENGES.map((c) => (
                <CommandItem key={c.id} value={`challenge ${c.title} ${c.difficulty}`} onSelect={() => go(`/challenges/${c.id}`)}>
                  {mark(c.id)} {c.title}
                  <CommandShortcut>{c.difficulty}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Build a product">
              {DESIGNS.map((d) => (
                <CommandItem key={d.id} value={`build ${d.title} ${d.category}`} onSelect={() => go(`/build/${d.id}`)}>
                  {mark(d.id)} {d.title}
                  <CommandShortcut>{d.category}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
