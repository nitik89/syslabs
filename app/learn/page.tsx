import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { LESSONS } from "@/data/lessons";
import { ROADMAP } from "@/data/roadmap";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <PageHeader
        eyebrow="Design foundations"
        title="The ideas behind every design"
        description={`${LESSONS.length} short lessons, a few minutes each. Every lesson ends with a problem where you put the idea to work in the simulator.`}
      />
      {/* One card per stage, title rows only; CSS columns pack short and long stages without gaps. */}
      <div className="mx-auto w-full max-w-[1280px] columns-1 gap-4 px-6 pb-12 md:columns-2 md:px-10 xl:columns-3">
        {ROADMAP.map((stage, i) => {
          const lessons = LESSONS.filter((l) => l.stage === stage.id);
          if (lessons.length === 0) return null;
          return (
            <section key={stage.id} className="surface mb-4 break-inside-avoid overflow-hidden rounded-2xl" aria-labelledby={`stage-${stage.id}`}>
              <h2 id={`stage-${stage.id}`} className="flex items-center gap-2.5 border-b border-border px-4 py-3 text-[14.5px] font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-background" style={{ background: stage.color }}>
                  {i + 1}
                </span>
                <span className="flex-1">{stage.title}</span>
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
                </span>
              </h2>
              <ul className="divide-y divide-border">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/learn/${l.id}`}
                      className="group flex items-center gap-2.5 px-4 py-2.5 outline-none transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.05]"
                    >
                      <BookOpen className="size-3.5 shrink-0" style={{ color: stage.color }} aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium group-hover:text-brand-blue">{l.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
