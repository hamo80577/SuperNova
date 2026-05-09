import { AdminSettingsPlaceholderPage } from "@/components/admin/admin-control-pages";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminSettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Read-only Phase 10 settings placeholders."
      title="System Settings"
    >
      <AdminSettingsPlaceholderPage />
    </DashboardFrame>
  );
}
