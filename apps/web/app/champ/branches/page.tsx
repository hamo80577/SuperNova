import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampBranchesIndex } from "@/components/workspaces/champ-branches";

export default function ChampBranchesPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Branch-first Champ operations."
      showPageTitle
      title="My Branches"
    >
      <ChampBranchesIndex />
    </DashboardFrame>
  );
}
