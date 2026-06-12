import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { SettingsHubPage } from "@/components/settings/settings-hub-page";

export default function SettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Workspace preferences and system configuration."
      showPageTitle
      title="Settings"
    >
      <SettingsHubPage />
    </DashboardFrame>
  );
}
