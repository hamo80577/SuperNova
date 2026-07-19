import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OperationsAnalysisReportPage } from "@/components/reports/operations-analysis-report-page";

export default function AreaManagerOperationsAnalysisReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Read-only operational analysis scoped to your assigned Chains."
      showPageTitle
      title="Operations Analysis"
    >
      <OperationsAnalysisReportPage variant="area-manager" />
    </DashboardFrame>
  );
}
