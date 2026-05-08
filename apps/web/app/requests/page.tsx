import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { RequestsCenter } from "@/components/requests/request-components";

export default function RequestsPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Generic request records and approval status."
      title="Requests"
    >
      <RequestsCenter />
    </DashboardFrame>
  );
}
