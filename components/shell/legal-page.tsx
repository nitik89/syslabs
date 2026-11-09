import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-6 py-12 md:px-10">
      <header className="space-y-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-[13px] text-muted-foreground">Last updated {updated}</p>
      </header>
      <div className="space-y-5 text-[14.5px] leading-relaxed text-foreground/90 [&_h2]:pt-2 [&_h2]:text-[17px] [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">{children}</div>
    </article>
  );
}
