import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { UsersAreaPage } from "@/components/users/users-area-page";

export default function UsersPage() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description=""
      hideHeaderCopy
      title=""
    >
      <UsersAreaPage />
    </DashboardFrame>
  );
}
