import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { PickerProfileCompletion } from "@/components/workspaces/picker-profile-completion";

export default function PickerProfileCompletionPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER"]}
      description="Complete required onboarding profile fields."
      title="Profile Completion"
    >
      <PickerProfileCompletion />
    </DashboardFrame>
  );
}
