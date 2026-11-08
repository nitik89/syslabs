import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { localDay } from "@/lib/storage";

export function StatTile({ icon: Icon, label, value, sub, accent }: { icon: LucideIcon; label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("flex size-7 items-center justify-center rounded-lg", accent)}>
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  // Skeleton of a stats row and two panels, so the page doesn't jump when data arrives.
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[92px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-sm space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-center">
      <p className="text-sm font-medium">Couldn&apos;t read your saved data</p>
      <p className="text-xs text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyBlock({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <Icon className="size-5 text-brand-cyan" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-sm text-xs text-muted-foreground">{body}</p>
      {children && <div className="mt-2 flex gap-2">{children}</div>}
    </div>
  );
}

/** GitHub-style activity grid for the last `weeks` weeks, from real active days only. */
export function ActivityGrid({ activeDays, today, weeks = 12 }: { activeDays: string[]; today: Date; weeks?: number }) {
  const active = new Set(activeDays);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  // Sunday of the week `weeks - 1` weeks ago, so every column is a full Sun–Sat week.
  start.setDate(start.getDate() - (weeks - 1) * 7 - end.getDay());
  const cols: Array<Array<{ day: string; on: boolean; future: boolean }>> = [];
  const cursor = new Date(start);
  while (cursor <= end || cursor.getDay() !== 0) {
    if (cursor.getDay() === 0) cols.push([]);
    const day = localDay(cursor);
    cols[cols.length - 1].push({ day, on: active.has(day), future: cursor > end });
    cursor.setDate(cursor.getDate() + 1);
  }
  const count = activeDays.filter((d) => d >= localDay(start) && d <= localDay(end)).length;
  return (
    <figure className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`${count} active day${count === 1 ? "" : "s"} in the last ${weeks} weeks`}>
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-1">
            {col.map((c) => (
              <span
                key={c.day}
                title={c.future ? undefined : `${c.day}${c.on ? ": active" : ""}`}
                className={cn(
                  "size-3 rounded-[3px]",
                  c.future ? "bg-transparent" : c.on ? "bg-gradient-to-br from-brand-cyan to-brand-violet" : "bg-secondary",
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <figcaption className="text-[11px] text-muted-foreground">
        {count} active day{count === 1 ? "" : "s"} in the last {weeks} weeks. A day counts when you run a simulation.
      </figcaption>
    </figure>
  );
}
