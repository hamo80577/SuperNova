import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampReportsPage } from "@/components/reports/report-pages";

export default function ChampReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Reports available for your assigned Branch scope."
      title="Reports"
    >
      <ChampReportsPage />
    </DashboardFrame>
  );
}
