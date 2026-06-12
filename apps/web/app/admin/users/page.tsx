import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { UsersAreaPage } from "@/components/users/users-area-page";

export default function UsersPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Role-specific operational users by assignment."
      showPageTitle
      title="Users"
    >
      <UsersAreaPage />
    </DashboardFrame>
  );
}
