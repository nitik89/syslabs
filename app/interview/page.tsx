import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { InterviewList } from "@/components/interview/interview-list";

export const metadata: Metadata = { title: "Mock interviews" };

export default function InterviewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Mock interviews"
        title="45 minutes, one system, one twist"
        description="Write the requirements, estimate the load, design it on the canvas, then handle the interviewer's twist. You get a scorecard against the E4, E5 and E6 bar."
      />
      <div className="mx-auto w-full max-w-[1280px] px-6 pb-12 md:px-10">
        <InterviewList />
      </div>
    </>
  );
}
