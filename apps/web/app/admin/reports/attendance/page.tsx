import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceReportPage } from "@/components/reports/attendance-report-page";

export default function AdminAttendanceReportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Read-only monthly attendance summaries for Pickers and Champs."
      title="Attendance Reports"
    >
      <AttendanceReportPage />
    </DashboardFrame>
  );
}
