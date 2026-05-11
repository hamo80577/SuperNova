import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampBranchWorkspace } from "@/components/workspaces/champ-branches";

export default function ChampBranchDetailPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Branch Pickers, requests, and actions."
      title="Branch Dashboard"
    >
      <ChampBranchWorkspace />
    </DashboardFrame>
  );
}
