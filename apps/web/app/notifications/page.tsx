import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { NotificationsCenter } from "@/components/notifications/notifications-center";

export default function NotificationsPage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="In-app workflow updates."
      showPageTitle
      title="Notifications"
    >
      <NotificationsCenter />
    </DashboardFrame>
  );
}
