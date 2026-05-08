import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { RequestDetailView } from "@/components/requests/request-components";

export default function RequestDetailPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Request timeline and approval steps."
      title="Request Detail"
    >
      <RequestDetailView />
    </DashboardFrame>
  );
}
