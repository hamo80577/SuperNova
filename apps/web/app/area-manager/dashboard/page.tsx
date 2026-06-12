import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AreaManagerCalmDashboard } from "@/components/workspaces/area-manager-calm-dashboard";

export default function AreaManagerDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Chain, branch, and scoped user visibility."
      hideHeaderDescription
      title="Dashboard"
    >
      <AreaManagerCalmDashboard />
    </DashboardFrame>
  );
}
