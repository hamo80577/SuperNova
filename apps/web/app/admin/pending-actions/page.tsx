import { AdminPendingActionsPage } from "@/components/admin/admin-control-pages";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function PendingActionsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Admin finalization queue."
      title="Pending Final Actions"
    >
      <AdminPendingActionsPage />
    </DashboardFrame>
  );
}
