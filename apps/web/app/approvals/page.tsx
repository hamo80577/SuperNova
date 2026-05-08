import { ApprovalsCenter } from "@/components/requests/request-components";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function ApprovalsPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Pending request approval actions."
      title="Approvals"
    >
      <ApprovalsCenter />
    </DashboardFrame>
  );
}
