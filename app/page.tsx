import { PageHeader } from "@/components/shell/page-header";
import { DashboardView } from "@/components/progress/dashboard-view";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Welcome to SysLab"
        description="Design architectures, run a deterministic simulation, and see exactly where they break."
      />
      <div className="p-6 md:p-8">
        <DashboardView />
      </div>
    </>
  );
}
