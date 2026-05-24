import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceReportPage } from "@/components/reports/attendance-report-page";

export default function AreaManagerAttendanceReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["AREA_MANAGER"]}
      description="Read-only attendance summaries scoped to your assigned Chains."
      title="Attendance Reports"
    >
      <AttendanceReportPage scope="area-manager" />
    </DashboardFrame>
  );
}
