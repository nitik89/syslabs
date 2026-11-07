import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeList } from "@/components/challenges/challenge-list";
import { DESIGNS, DESIGN_CATEGORIES } from "@/data/designs";

export const metadata: Metadata = { title: "Build" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function BuildPage() {
  return (
    <>
      <PageHeader
        eyebrow="Build"
        title="Design real products from scratch"
        description="Pick a product (a shopping app, a chat app, a social feed and more), read its requirements and scale, then design it on a blank canvas. Your design is scored on the simulation and on whether it meets each requirement. A reference architecture is there if you get stuck."
      />
      <div className="space-y-8 p-6 md:p-8">
        <nav aria-label="Product areas" className="flex flex-wrap gap-2">
          {DESIGN_CATEGORIES.map((c) => (
            <a
              key={c}
              href={`#${slug(c)}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
            >
              {c} <span className="font-mono opacity-60">{DESIGNS.filter((d) => d.category === c).length}</span>
            </a>
          ))}
        </nav>
        {DESIGN_CATEGORIES.map((c) => (
          <section key={c} id={slug(c)} className="scroll-mt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{c}</h2>
            <ChallengeList challenges={DESIGNS.filter((d) => d.category === c)} />
          </section>
        ))}
      </div>
    </>
  );
}
