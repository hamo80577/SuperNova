import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OrdersKpiReportPage } from "@/components/orders-kpis/orders-kpi-report-page";

export default function AdminOrdersKpiReportPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Vendor-first operational KPI workspace."
      showPageTitle
      title="Orders KPI Performance"
    >
      <OrdersKpiReportPage />
    </DashboardFrame>
  );
}
