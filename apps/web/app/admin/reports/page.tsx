import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AdminReportsPage } from "@/components/reports/report-pages";

export default function AdminReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="System-wide operational counts."
      title="Admin Reports"
    >
      <AdminReportsPage />
    </DashboardFrame>
  );
}
