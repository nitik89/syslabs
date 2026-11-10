import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, Cog, Lightbulb, MessageSquareQuote, Scale, Workflow } from "lucide-react";
import { LESSONS, getLesson } from "@/data/lessons";
import { ROADMAP } from "@/data/roadmap";
import { getChallenge } from "@/data/challenges";
import { getDesign } from "@/data/designs";
import { buttonVariants } from "@/components/ui/button";
import { LESSON_DIAGRAMS } from "@/data/lesson-diagrams";
import { LESSON_DEEP } from "@/data/lesson-deep";
import { LessonDiagram } from "@/components/learn/lesson-diagram";
import { readingMinutes } from "@/data/lesson-deep";

function SectionTitle({ icon: Icon, children, tone = "text-brand-blue" }: { icon: typeof Cog; children: React.ReactNode; tone?: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-tight">
      <Icon className={`size-[18px] ${tone}`} aria-hidden="true" /> {children}
    </h2>
  );
}

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getLesson(id)?.title ?? "Lesson" };
}

export default function LessonPage({ params }: PageProps<"/learn/[id]">) {
  return (
    <Suspense>
      <Lesson params={params} />
    </Suspense>
  );
}

async function Lesson({ params }: { params: PageProps<"/learn/[id]">["params"] }) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const stage = ROADMAP.find((s) => s.id === lesson.stage)!;
  const problem = getChallenge(lesson.practice) ?? getDesign(lesson.practice);
  const href = problem ? `${problem.mode === "build" ? "/build" : "/challenges"}/${problem.id}` : "/challenges";
  const idx = LESSONS.indexOf(lesson);
  const next = LESSONS[idx + 1];
  const diagram = LESSON_DIAGRAMS[lesson.id];
  const deep = LESSON_DEEP[lesson.id];

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10 md:px-10">
      <Link href="/learn" className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All lessons
      </Link>
      <header className="space-y-3">
        <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: stage.color }}>
          {stage.title} · lesson {idx + 1} of {LESSONS.length}
          <span className="flex items-center gap-1 font-normal normal-case tracking-normal text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" /> {readingMinutes(lesson)} min
          </span>
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">{lesson.title}</h1>
        <p className="text-[16px] leading-relaxed text-muted-foreground">{lesson.summary}</p>
      </header>

      {diagram && <LessonDiagram diagram={diagram} id={`d-${lesson.id}`} />}

      <section className="space-y-3">
        <SectionTitle icon={Lightbulb}>Key ideas</SectionTitle>
      <ol className="space-y-3">
        {lesson.points.map((p, i) => (
          <li key={p} className="flex gap-3 text-[15px] leading-relaxed">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-muted-foreground">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
      </section>

      {deep && (
        <>
          <section className="space-y-5">
            <SectionTitle icon={Cog}>Under the hood</SectionTitle>
            {deep.sections.map((sec) => (
              <div key={sec.heading} className="space-y-2.5">
                <h3 className="text-[16px] font-semibold">{sec.heading}</h3>
                {sec.body.map((p) => (
                  <p key={p} className="text-[15px] leading-relaxed text-foreground/85">
                    {p}
                  </p>
                ))}
              </div>
            ))}
          </section>

          <section className="surface space-y-3 rounded-2xl p-5">
            <SectionTitle icon={Workflow} tone="text-brand-cyan">
              Worked example: {deep.example.title}
            </SectionTitle>
            <ol className="space-y-2.5">
              {deep.example.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-[14.5px] leading-relaxed">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-cyan/12 font-mono text-[11px] font-semibold text-brand-cyan">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-3">
            <SectionTitle icon={Scale} tone="text-brand-violet">
              Trade-offs
            </SectionTitle>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[520px] text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-border bg-white/[0.02] font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-4 py-2.5 font-normal">Option</th>
                    <th className="px-4 py-2.5 font-normal">Good</th>
                    <th className="px-4 py-2.5 font-normal">Costs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deep.tradeoffs.map((t) => (
                    <tr key={t.option} className="align-top">
                      <td className="px-4 py-3 font-semibold">{t.option}</td>
                      <td className="px-4 py-3 text-status-ok">{t.pros}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.cons}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-2xl border border-status-crit/25 bg-status-crit/[0.05] p-5">
              <SectionTitle icon={AlertTriangle} tone="text-status-crit">
                Common mistakes
              </SectionTitle>
              <ul className="space-y-2">
                {deep.mistakes.map((m) => (
                  <li key={m} className="flex gap-2 text-[14px] leading-relaxed">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-status-crit" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </section>
            <section className="space-y-3 rounded-2xl border border-brand-blue/25 bg-brand-blue/[0.05] p-5">
              <SectionTitle icon={MessageSquareQuote}>In an interview</SectionTitle>
              <ul className="space-y-2">
                {deep.interview.map((m) => (
                  <li key={m} className="flex gap-2 text-[14px] leading-relaxed">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden="true" />
                    {m}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}

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
