import type { Metadata } from "next";
import { Suspense } from "react";
import { LabClient } from "@/components/lab/lab-client";
import { SimulatedTag } from "@/components/lab/metrics-panel";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100dvh-3rem)]">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">Lab</h1>
          <p className="truncate text-xs text-muted-foreground">Free-form canvas. Build any architecture and stress it with the simulator.</p>
        </div>
        <SimulatedTag />
      </div>
      <Suspense fallback={<div className="flex-1" />}>
        <LabClient />
      </Suspense>
    </div>
  );
}
