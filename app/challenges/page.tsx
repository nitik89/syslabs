import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeList, ProgressSummary } from "@/components/challenges/challenge-list";
import { CHALLENGES } from "@/data/challenges";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Challenges"
        title="Fix broken architectures"
        description="Each challenge gives you a scenario, fixed traffic and a set of objectives. Your score (0 to 100) comes from the simulation: performance, reliability, cost and architecture."
        actions={<ProgressSummary challenges={CHALLENGES} noun="challenges" />}
      />
      <div className="px-6 pb-10 md:px-10">
        <ChallengeList challenges={CHALLENGES} filters />
      </div>
    </>
  );
}
