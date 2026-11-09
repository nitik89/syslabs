import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ChallengeList, ProgressSummary } from "@/components/challenges/challenge-list";
import { DESIGNS } from "@/data/designs";

export const metadata: Metadata = { title: "Build" };

export default function BuildPage() {
  return (
    <>
      <PageHeader
        eyebrow="Build"
        title="Design real products from scratch"
        description="Pick a product (a shopping app, a chat app, a social feed and more), read its requirements and scale, then design it on a blank canvas. Your design is scored on the simulation and on whether it meets each requirement. You can reveal a solution if you get stuck."
        actions={<ProgressSummary challenges={DESIGNS} noun="products" />}
      />
      <div className="px-6 pb-10 md:px-10">
        <ChallengeList challenges={DESIGNS} filters />
      </div>
    </>
  );
}
