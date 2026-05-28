import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceDailyReportPage } from "@/components/reports/attendance-daily-report-page";

export default function AreaManagerAttendanceReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Read-only attendance scoped to current operational assignments."
      title="Attendance Report"
    >
      <AttendanceDailyReportPage variant="area-manager" />
    </DashboardFrame>
  );
}
