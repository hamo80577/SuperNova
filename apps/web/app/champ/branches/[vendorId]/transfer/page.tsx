import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { ChampTransferForm } from "@/components/workspaces/champ-transfer-form";

export default function ChampBranchTransferPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Create a Branch-scoped Picker Transfer request."
      title="Transfer Picker"
    >
      <ChampTransferForm />
    </DashboardFrame>
  );
}
