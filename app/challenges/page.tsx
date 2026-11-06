import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeList } from "@/components/challenges/challenge-list";
import { CHALLENGES } from "@/data/challenges";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Challenges"
        title="Fix broken architectures"
        description="Each challenge gives you a scenario, fixed traffic and a set of objectives. Your score (0 to 100) is computed from the simulation: performance, reliability, cost and architecture."
      />
      <div className="p-6 md:p-8">
        <ChallengeList challenges={CHALLENGES} />
      </div>
    </>
  );
}
