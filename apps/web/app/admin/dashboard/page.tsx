import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AdminWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function AdminDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="System-wide operational workspace."
      title="Admin Workspace"
    >
      <AdminWorkspaceDashboard />
    </DashboardFrame>
  );
}
