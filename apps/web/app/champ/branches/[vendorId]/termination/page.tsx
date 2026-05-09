import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampOffboardingForm } from "@/components/workspaces/champ-offboarding-form";

export default function ChampBranchTerminationPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Create a Branch-scoped Picker termination request."
      title="Termination"
    >
      <ChampOffboardingForm type="TERMINATION" />
    </DashboardFrame>
  );
}
