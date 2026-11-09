import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { INTERVIEWS, getInterview } from "@/data/interviews";
import { getDesign } from "@/data/designs";
import { InterviewSession } from "@/components/interview/interview-session";

export function generateStaticParams() {
  return INTERVIEWS.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: PageProps<"/interview/[id]">): Promise<Metadata> {
  const { id } = await params;
  const iv = getInterview(id);
  return { title: iv ? `Mock interview: ${getDesign(iv.problem)?.title}` : "Mock interview" };
}

async function Loader({ params }: { params: PageProps<"/interview/[id]">["params"] }) {
  const { id } = await params;
  const interview = getInterview(id);
  const problem = interview ? getDesign(interview.problem) : undefined;
  if (!interview || !problem) notFound();
  return <InterviewSession interview={interview} problem={problem} />;
}

export default function InterviewSessionPage({ params }: PageProps<"/interview/[id]">) {
  return (
    <Suspense>
      <Loader params={params} />
    </Suspense>
  );
}
