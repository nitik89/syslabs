import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { LeaderboardView } from "@/components/community/community-views";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <>
      <PageHeader eyebrow="Community" title="Leaderboard" description="Ranked by XP from solved challenges and products. Only people with a public profile appear here." />
      <div className="mx-auto w-full max-w-4xl px-6 pb-12 md:px-10">
        <LeaderboardView />
      </div>
    </>
  );
}
