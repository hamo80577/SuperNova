import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AdminReportsPage } from "@/components/reports/report-pages";

export default function AdminReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Reports available for the Admin workspace."
      title="Reports"
    >
      <AdminReportsPage />
    </DashboardFrame>
  );
}
