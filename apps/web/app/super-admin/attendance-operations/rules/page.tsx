import { AttendanceOperationsRulesPage } from "@/components/attendance/attendance-operations-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function SuperAdminAttendanceRulesRoute() {
  return (
    <DashboardFrame
      allowedRoles={["SUPER_ADMIN"]}
      description="Upload, validate, process, and review attendance data."
      title="Attendance Data Operations"
    >
      <AttendanceOperationsRulesPage />
    </DashboardFrame>
  );
}
