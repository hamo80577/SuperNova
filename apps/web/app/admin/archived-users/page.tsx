import { AdminArchivedUsersPage } from "@/components/admin/admin-control-pages";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function ArchivedUsersPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Archived and deactivated user visibility."
      title="Archived Users"
    >
      <AdminArchivedUsersPage />
    </DashboardFrame>
  );
}
