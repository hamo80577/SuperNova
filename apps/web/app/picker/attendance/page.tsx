import { PickerSelfAttendancePage } from "@/components/attendance/picker-self-attendance-page";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function PickerAttendancePage() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER"]}
      description="Your own attendance score, shift history, and clean-shift progress."
      title="My Attendance"
    >
      <PickerSelfAttendancePage />
    </DashboardFrame>
  );
}
