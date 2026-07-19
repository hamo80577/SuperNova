import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OperationsAnalysisReportPage } from "@/components/reports/operations-analysis-report-page";

export default function ChampOperationsAnalysisReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Read-only operational analysis scoped to your assigned Branches."
      showPageTitle
      title="Operations Analysis"
    >
      <OperationsAnalysisReportPage variant="champ" />
    </DashboardFrame>
  );
}
