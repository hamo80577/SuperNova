import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AreaManagerWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function AreaManagerDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Chain, branch, and scoped user visibility."
      title="Area Manager Workspace"
    >
      <AreaManagerWorkspaceDashboard />
    </DashboardFrame>
  );
}
