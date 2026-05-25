import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { AttendanceImportConsolePage } from "@/components/attendance/attendance-import-console-page";

export default function AdminAttendanceImportsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Upload, preview, and confirm monthly Picker attendance batches."
      title="Attendance Imports"
    >
      <AttendanceImportConsolePage />
    </DashboardFrame>
  );
}
