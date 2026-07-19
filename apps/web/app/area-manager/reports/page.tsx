import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AreaManagerReportsPage } from "@/components/reports/report-pages";

export default function AreaManagerReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Reports available for your assigned Chain scope."
      title="Reports"
    >
      <AreaManagerReportsPage />
    </DashboardFrame>
  );
}
