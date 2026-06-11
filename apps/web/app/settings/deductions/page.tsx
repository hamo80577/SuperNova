import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { DeductionPolicySettingsPage } from "@/components/deductions/deduction-policy-settings-page";
import { SettingsBackLink } from "@/components/settings/settings-back-link";

export default function DeductionPolicySettingsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Occurrence rules applied by Deduction tickets."
      title="Deduction Policy"
    >
      <SettingsBackLink />
      <DeductionPolicySettingsPage />
    </DashboardFrame>
  );
}
