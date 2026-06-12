import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { RequestOperationsCenter } from "@/components/requests/request-components";

export default function TicketsPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Operational lifecycle tickets, approvals, and final actions."
      hideHeaderDescription
      showPageTitle
      title="Tickets"
    >
      <RequestOperationsCenter defaultMode="open" />
    </DashboardFrame>
  );
}
