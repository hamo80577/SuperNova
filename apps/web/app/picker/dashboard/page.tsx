import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { PickerWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function PickerDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER"]}
      description="Profile, branch, and manager context."
      title="Picker Workspace"
    >
      <PickerWorkspaceDashboard />
    </DashboardFrame>
  );
}
