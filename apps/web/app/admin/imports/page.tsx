import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { ImportsCenterPage } from "@/components/orders-kpis/imports-center-page";

export default function AdminImportsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Admin import workflows for operational files."
      title="Imports"
    >
      <ImportsCenterPage />
    </DashboardFrame>
  );
}
