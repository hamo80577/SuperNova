import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampOffboardingForm } from "@/components/workspaces/champ-offboarding-form";

export default function ChampBranchResignationPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Create a Branch-scoped Picker resignation request."
      title="Resignation"
    >
      <ChampOffboardingForm type="RESIGNATION" />
    </DashboardFrame>
  );
}
