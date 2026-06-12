import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AppearanceSettingsPage } from "@/components/settings/appearance-settings-page";
import { SettingsBackLink } from "@/components/settings/settings-back-link";

export default function AppearanceSettingsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Personal appearance controls for your SuperNova workspace."
      showPageTitle
      title="Appearance"
    >
      <SettingsBackLink />
      <AppearanceSettingsPage />
    </DashboardFrame>
  );
}
