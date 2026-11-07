import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeList, ProgressSummary } from "@/components/challenges/challenge-list";
import { DESIGNS, DESIGN_CATEGORIES } from "@/data/designs";

export const metadata: Metadata = { title: "Build" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function BuildPage() {
  return (
    <>
      <PageHeader
        eyebrow="Build"
        title="Design real products from scratch"
        description="Pick a product (a shopping app, a chat app, a social feed and more), read its requirements and scale, then design it on a blank canvas. Your design is scored on the simulation and on whether it meets each requirement. You can reveal a solution if you get stuck."
        actions={<ProgressSummary challenges={DESIGNS} noun="products" />}
      />
      <div className="space-y-10 px-6 pb-10 md:px-10">
        <nav aria-label="Product areas" className="flex flex-wrap gap-2">
          {DESIGN_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#${slug(c)}`}
              className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border transition-colors hover:text-foreground hover:ring-white/20"
            >
              {c} <span className="font-mono opacity-60">{DESIGNS.filter((d) => d.category === c).length}</span>
            </a>
          ))}
        </nav>
        {DESIGN_CATEGORIES.map((c) => (
          <section key={c} id={slug(c)} className="scroll-mt-6 space-y-4">
            <h2 className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{c}<span className="h-px flex-1 bg-border" aria-hidden="true" /></h2>
            <ChallengeList challenges={DESIGNS.filter((d) => d.category === c)} />
          </section>
        ))}
      </div>
    </>
  );
}
