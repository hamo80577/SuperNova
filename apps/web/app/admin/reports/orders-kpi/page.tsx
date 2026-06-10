import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OrdersKpiReportPage } from "@/components/orders-kpis/orders-kpi-report-page";

export default function AdminOrdersKpiReportPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Confirmed Orders KPI performance report."
      title="Orders KPI Report"
    >
      <OrdersKpiReportPage />
    </DashboardFrame>
  );
}
