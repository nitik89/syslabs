import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingUp } from "@/components/shell/coming-up";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return (
    <>
      <PageHeader eyebrow="Progress" title="Progress" description="Completed challenges, best scores, XP, streak and saved designs." />
      <ComingUp icon={TrendingUp} title="No progress recorded yet" body="This section is under construction." />
    </>
  );
}
