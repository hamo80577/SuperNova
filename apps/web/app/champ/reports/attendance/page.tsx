import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceReportPage } from "@/components/reports/attendance-report-page";

export default function ChampAttendanceReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["CHAMP"]}
      description="Read-only attendance summaries scoped to your assigned Branches."
      title="Attendance Reports"
    >
      <AttendanceReportPage scope="champ" />
    </DashboardFrame>
  );
}
