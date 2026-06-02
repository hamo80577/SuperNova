import { AttendanceImportConsolePage } from "@/components/attendance/attendance-import-console-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminHistoricalAttendanceImportRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Import a closed historical monthly attendance batch."
      title="Historical Attendance Import"
    >
      <AttendanceImportConsolePage
        backHref="/admin/attendance/imports"
        description="Import a closed historical month without changing assignments, users, branches, or hierarchy records."
        importMode="HISTORICAL_MONTH"
        title="Historical Attendance Import"
      />
    </DashboardFrame>
  );
}
