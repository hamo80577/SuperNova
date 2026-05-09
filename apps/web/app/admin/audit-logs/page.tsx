import { AdminAuditLogsPage } from "@/components/admin/admin-control-pages";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AuditLogsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Sensitive action history."
      title="Audit Logs"
    >
      <AdminAuditLogsPage />
    </DashboardFrame>
  );
}
