import { ChainsAdmin } from "@/components/admin/chains-admin";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminChainsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Admin-controlled chain management."
      title="Chains"
    >
      <ChainsAdmin />
    </DashboardFrame>
  );
}
