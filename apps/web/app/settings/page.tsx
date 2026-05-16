import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AppearanceSettingsPage } from "@/components/settings/appearance-settings-page";

export default function SettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Personal appearance controls for your SuperNova workspace."
      title="Settings"
    >
      <AppearanceSettingsPage />
    </DashboardFrame>
  );
}
