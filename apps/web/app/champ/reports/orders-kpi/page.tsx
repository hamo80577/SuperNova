import { DashboardFrame } from "@/components/dashboard/dashboard-frame";
import { OrdersKpiReportPage } from "@/components/orders-kpis/orders-kpi-report-page";

export default function ChampOrdersKpiReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Orders KPI performance scoped to your assigned branches."
      title="Orders KPI Performance"
    >
      <OrdersKpiReportPage variant="champ" />
    </DashboardFrame>
  );
}
