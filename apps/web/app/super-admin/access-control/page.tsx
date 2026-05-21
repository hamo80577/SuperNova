import { AccessControlOverviewPage } from "@/components/access-control/access-control-overview-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function SuperAdminAccessControlRoute() {
  return (
    <DashboardFrame
      allowedRoles={["SUPER_ADMIN"]}
      description="Permission catalog and system role matrix."
      title="Access Control"
    >
      <AccessControlOverviewPage />
    </DashboardFrame>
  );
}
