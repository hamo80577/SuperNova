import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { OrdersKpisReportPage } from "@/components/reports/orders-kpis-report-page";

export default function AdminOrdersKpisReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Review confirmed Orders KPI performance by Chain, Vendor, and Picker."
      title="Orders KPI Report"
    >
      <OrdersKpisReportPage />
    </DashboardFrame>
  );
}
