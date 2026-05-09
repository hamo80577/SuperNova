import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AreaManagerReportsPage } from "@/components/reports/report-pages";

export default function AreaManagerReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Chain-scoped operational counts."
      title="Area Manager Reports"
    >
      <AreaManagerReportsPage />
    </DashboardFrame>
  );
}
