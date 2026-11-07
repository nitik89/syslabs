import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChallengeClient } from "@/components/challenges/challenge-client";
import { DESIGNS, getDesign } from "@/data/designs";

export function generateStaticParams() {
  return DESIGNS.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/build/[id]">): Promise<Metadata> {
  const { id } = await params;
  const d = getDesign(id);
  return { title: d ? `Build: ${d.title}` : "Build" };
}

async function DesignLoader({ params }: { params: PageProps<"/build/[id]">["params"] }) {
  const { id } = await params;
  const design = getDesign(id);
  if (!design) notFound();
  const next = DESIGNS[DESIGNS.indexOf(design) + 1];
  return <ChallengeClient challenge={design} next={next && { id: next.id, title: next.title }} />;
}

export default function BuildProblemPage({ params }: PageProps<"/build/[id]">) {
  // URL data is read inside Suspense so the shared shell can render instantly on navigation.
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading problem…
        </div>
      }
    >
      <DesignLoader params={params} />
    </Suspense>
  );
}
