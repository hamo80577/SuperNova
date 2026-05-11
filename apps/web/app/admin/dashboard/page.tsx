import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AdminWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function AdminDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Organization setup, final actions, audit, and reporting."
      title="Admin Control Center"
    >
      <AdminWorkspaceDashboard />
    </DashboardFrame>
  );
}
