import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampReportsPage } from "@/components/reports/report-pages";

export default function ChampReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Branch-scoped operational counts."
      title="Champ Reports"
    >
      <ChampReportsPage />
    </DashboardFrame>
  );
}
