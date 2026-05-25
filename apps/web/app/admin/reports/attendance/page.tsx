import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceDailyReportPage } from "@/components/reports/attendance-daily-report-page";

export default function AdminAttendanceReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Read-only Picker attendance rows from confirmed active batches."
      title="Attendance Report"
    >
      <AttendanceDailyReportPage />
    </DashboardFrame>
  );
}
