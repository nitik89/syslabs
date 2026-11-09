import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { RoadmapView } from "@/components/roadmap/roadmap";

export const metadata: Metadata = { title: "Roadmap" };

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        eyebrow="Learning path"
        title="Learn it by breaking it, one stage at a time"
        description="Six stages that build on each other. Read the short lessons, then fix and build systems that use them. Each stage ends with a checkpoint problem."
      />
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-12 md:px-10">
        <RoadmapView />
      </div>
    </>
  );
}
