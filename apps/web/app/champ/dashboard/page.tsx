import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function ChampDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Branch performance overview."
      title="Dashboard"
    >
      <ChampWorkspaceDashboard />
    </DashboardFrame>
  );
}
