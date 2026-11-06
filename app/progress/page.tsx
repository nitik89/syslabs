import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ProgressView } from "@/components/progress/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader eyebrow="Progress" title="Your progress" description="Scores, XP, streak and saved designs. Everything is stored locally in this browser." />
      <div className="p-6 md:p-8">
        <ProgressView />
      </div>
    </>
  );
}
