import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OperationsAnalysisReportPage } from "@/components/reports/operations-analysis-report-page";

export default function AdminOperationsAnalysisReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Read-only operational analysis from existing system data."
      showPageTitle
      title="Operations Analysis"
    >
      <OperationsAnalysisReportPage variant="admin" />
    </DashboardFrame>
  );
}
