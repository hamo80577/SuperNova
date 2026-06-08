import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { OrdersKpisImportsPage } from "@/components/reports/orders-kpis-imports-page";

export default function AdminOrdersKpisImportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Upload Orders KPI sheets, review validation issues, then approve valid rows or reject the review."
      title="Orders KPIs"
    >
      <OrdersKpisImportsPage />
    </DashboardFrame>
  );
}
