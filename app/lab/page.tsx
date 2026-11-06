import type { Metadata } from "next";
import { FlaskConical } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingUp } from "@/components/shell/coming-up";

export const metadata: Metadata = { title: "Lab" };

export default function LabPage() {
  return (
    <>
      <PageHeader eyebrow="Lab" title="Lab" description="A free-form canvas to build any architecture and run the simulator on it." />
      <ComingUp icon={FlaskConical} title="The canvas is not ready yet" body="This section is under construction." />
    </>
  );
}
