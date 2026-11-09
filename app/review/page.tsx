import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ReviewView } from "@/components/review/review-view";

export const metadata: Metadata = { title: "Flashcards" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader eyebrow="Flashcards" title="A few minutes of recall a day" description="Short cards from every lesson, scheduled with spaced repetition so they come back right before you'd forget them." />
      <div className="mx-auto w-full max-w-5xl px-6 pb-12 md:px-10">
        <ReviewView />
      </div>
    </>
  );
}
