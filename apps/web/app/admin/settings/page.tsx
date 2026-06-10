import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { SettingsHubPage } from "@/components/settings/settings-hub-page";

export default function AdminSettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Workspace preferences and system configuration."
      title="Settings"
    >
      <SettingsHubPage />
    </DashboardFrame>
  );
}
