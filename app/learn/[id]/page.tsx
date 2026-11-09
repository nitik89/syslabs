import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, Lightbulb } from "lucide-react";
import { LESSONS, getLesson } from "@/data/lessons";
import { ROADMAP } from "@/data/roadmap";
import { getChallenge } from "@/data/challenges";
import { getDesign } from "@/data/designs";
import { buttonVariants } from "@/components/ui/button";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getLesson(id)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: PageProps<"/learn/[id]">) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const stage = ROADMAP.find((s) => s.id === lesson.stage)!;
  const problem = getChallenge(lesson.practice) ?? getDesign(lesson.practice);
  const href = problem ? `${problem.mode === "build" ? "/build" : "/challenges"}/${problem.id}` : "/challenges";
  const idx = LESSONS.indexOf(lesson);
  const next = LESSONS[idx + 1];

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10 md:px-10">
      <Link href="/learn" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All lessons
      </Link>
      <header className="space-y-3">
        <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: stage.color }}>
          {stage.title} · lesson {idx + 1} of {LESSONS.length}
          <span className="flex items-center gap-1 font-normal normal-case tracking-normal text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" /> {lesson.minutes} min
          </span>
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{lesson.title}</h1>
        <p className="text-[16px] leading-relaxed text-muted-foreground">{lesson.summary}</p>
      </header>

      <ol className="space-y-3">
        {lesson.points.map((p, i) => (
          <li key={p} className="flex gap-3 text-[15px] leading-relaxed">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>

      <aside className="flex gap-3 rounded-2xl border border-status-warn/25 bg-status-warn/[0.06] p-4">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-status-warn" aria-hidden="true" />
        <p className="text-[14px] leading-relaxed">
          <span className="font-semibold">Rule of thumb. </span>
          {lesson.ruleOfThumb}
        </p>
      </aside>

      {problem && (
        <section className="surface flex flex-wrap items-center gap-4 rounded-2xl p-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Put it to work</p>
            <h2 className="text-[16px] font-semibold">{problem.title}</h2>
            <p className="text-[13px] text-muted-foreground">{problem.summary}</p>
          </div>
          <Link href={href} className={buttonVariants({ size: "lg" })}>
            Practise <ArrowRight />
          </Link>
        </section>
      )}

      {next && (
        <Link href={`/learn/${next.id}`} className="flex items-center justify-end gap-1 text-[13px] text-brand-blue hover:underline">
          Next lesson: {next.title} <ArrowRight className="size-3.5" />
        </Link>
      )}
    </article>
  );
}
