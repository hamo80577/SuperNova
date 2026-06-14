import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { PickerWorkspaceDashboard } from "@/components/workspaces/role-workspaces";

export default function PickerDashboardPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER"]}
      description="Personal attendance, orders, ranking, deductions, leave, and notifications."
      title="My Workday"
    >
      <PickerWorkspaceDashboard />
    </DashboardFrame>
  );
}
