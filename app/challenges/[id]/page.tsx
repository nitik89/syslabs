import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ChallengeClient } from "@/components/challenges/challenge-client";
import { CHALLENGES, getChallenge } from "@/data/challenges";

export function generateStaticParams() {
  return CHALLENGES.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/challenges/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getChallenge(id)?.title ?? "Challenge" };
}

async function ChallengeLoader({ params }: { params: PageProps<"/challenges/[id]">["params"] }) {
  const { id } = await params;
  const challenge = getChallenge(id);
  if (!challenge) notFound();
  return <ChallengeClient challenge={challenge} />;
}

export default function ChallengePage({ params }: PageProps<"/challenges/[id]">) {
  // URL data is read inside Suspense so the shared shell can render instantly on navigation.
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" /> Loading challenge…
        </div>
      }
    >
      <ChallengeLoader params={params} />
    </Suspense>
  );
}
