import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OrdersKpiImportPage } from "@/components/orders-kpis/orders-kpi-import-page";

export default function AdminOrdersKpiImportPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Upload, preview, review, and confirm Orders KPI daily snapshots."
      title="Orders KPI Import"
    >
      <OrdersKpiImportPage />
    </DashboardFrame>
  );
}
