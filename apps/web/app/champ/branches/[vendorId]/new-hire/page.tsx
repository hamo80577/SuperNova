import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampNewHireForm } from "@/components/workspaces/champ-new-hire-form";

export default function ChampBranchNewHirePage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Create a Branch-scoped New Hire request."
      title="New Hire"
    >
      <ChampNewHireForm />
    </DashboardFrame>
  );
}
