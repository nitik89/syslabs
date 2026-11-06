import type { LucideIcon } from "lucide-react";

/** Honest empty state for sections still being built. No fake data, no dead buttons. */
export function ComingUp({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="bg-grid flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-8 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-brand-cyan">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
