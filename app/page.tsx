import { LayoutDashboard } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ComingUp } from "@/components/shell/coming-up";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Welcome to SysLab"
        description="Design architectures, run a deterministic simulation, and see exactly where they break."
      />
      <ComingUp
        icon={LayoutDashboard}
        title="Nothing here yet"
        body="Your activity summary appears once challenges and the Lab are available and you have saved progress."
      />
    </>
  );
}
