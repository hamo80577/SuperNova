import { AdminUsersPage } from "@/components/admin/admin-users-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function UsersPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="All users, profile details, filters, and export controls."
      title="Users"
    >
      <AdminUsersPage />
    </DashboardFrame>
  );
}
