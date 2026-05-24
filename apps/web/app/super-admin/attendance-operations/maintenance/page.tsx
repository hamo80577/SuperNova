import { AttendanceOperationsMaintenancePage } from "@/components/attendance/attendance-maintenance-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function SuperAdminAttendanceMaintenanceRoute() {
  return (
    <DashboardFrame
      allowedRoles={["SUPER_ADMIN"]}
      description="Upload, validate, process, and review attendance data."
      title="Attendance Data Operations"
    >
      <AttendanceOperationsMaintenancePage />
    </DashboardFrame>
  );
}
