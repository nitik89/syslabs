import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
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
      <div className="mx-auto w-full max-w-[1280px] space-y-8 px-6 pb-12 md:px-10">
        {ROADMAP.map((stage, i) => {
          const lessons = LESSONS.filter((l) => l.stage === stage.id);
          if (lessons.length === 0) return null;
          return (
            <section key={stage.id} className="space-y-3">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <span className="flex size-6 items-center justify-center rounded-full font-mono text-[11px] font-bold text-background" style={{ background: stage.color }}>
                  {i + 1}
                </span>
                {stage.title}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link href={`/learn/${l.id}`} className="surface surface-hover flex h-full flex-col gap-2 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4" style={{ color: stage.color }} aria-hidden="true" />
                        <h3 className="flex-1 text-[14.5px] font-semibold tracking-tight">{l.title}</h3>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                          <Clock className="size-3" aria-hidden="true" /> {l.minutes} min
                        </span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-muted-foreground">{l.summary}</p>
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
