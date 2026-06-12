import { OrganizationControlCenter } from "@/components/admin/organization-control-center";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminOrganizationPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Chains, Branches, and assignment setup."
      showPageTitle
      title="Organization"
    >
      <OrganizationControlCenter />
    </DashboardFrame>
  );
}
