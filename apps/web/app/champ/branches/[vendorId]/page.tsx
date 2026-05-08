import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampBranchWorkspace } from "@/components/workspaces/champ-branches";

export default function ChampBranchDetailPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Selected Branch operational context."
      title="Branch Workspace"
    >
      <ChampBranchWorkspace />
    </DashboardFrame>
  );
}
