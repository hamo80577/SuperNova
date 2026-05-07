import { VendorsAdmin } from "@/components/admin/vendors-admin";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminVendorsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Admin-controlled vendor and branch management."
      title="Vendors / Branches"
    >
      <VendorsAdmin />
    </DashboardFrame>
  );
}
