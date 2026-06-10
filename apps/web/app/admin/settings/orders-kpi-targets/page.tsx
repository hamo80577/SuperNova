import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { OrdersKpiTargetSettingsPage } from "@/components/orders-kpis/orders-kpi-target-settings-page";
import { SettingsBackLink } from "@/components/settings/settings-back-link";

export default function AdminOrdersKpiTargetsSettingsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Global Orders KPI target thresholds."
      title="Orders KPI Targets"
    >
      <SettingsBackLink />
      <OrdersKpiTargetSettingsPage />
    </DashboardFrame>
  );
}
