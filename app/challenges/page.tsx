import type { Metadata } from "next";
import { Target } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingUp } from "@/components/shell/coming-up";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <>
      <PageHeader eyebrow="Challenges" title="Challenges" description="Guided scenarios with broken architectures to fix, scored from simulation output." />
      <ComingUp icon={Target} title="No challenges loaded yet" body="This section is under construction." />
    </>
  );
}
