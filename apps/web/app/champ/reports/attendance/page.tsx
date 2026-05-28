import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceDailyReportPage } from "@/components/reports/attendance-daily-report-page";

export default function ChampAttendanceReportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Read-only attendance scoped to assigned branches and Pickers."
      title="Attendance Report"
    >
      <AttendanceDailyReportPage variant="champ" />
    </DashboardFrame>
  );
}
