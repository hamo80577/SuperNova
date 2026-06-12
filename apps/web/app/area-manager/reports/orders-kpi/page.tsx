import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OrdersKpiReportPage } from "@/components/orders-kpis/orders-kpi-report-page";

export default function AreaManagerOrdersKpiReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Orders KPI performance scoped to your assigned chains."
      showPageTitle
      title="Orders KPI Performance"
    >
      <OrdersKpiReportPage variant="area-manager" />
    </DashboardFrame>
  );
}
