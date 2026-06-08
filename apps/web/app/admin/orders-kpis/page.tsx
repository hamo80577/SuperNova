import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { OrdersKpisPage } from "@/components/reports/orders-kpis-page";

export default function AdminOrdersKpisRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Upload, preview, confirm, and review picker Orders KPI rows."
      title="Orders KPIs"
    >
      <OrdersKpisPage />
    </DashboardFrame>
  );
}
