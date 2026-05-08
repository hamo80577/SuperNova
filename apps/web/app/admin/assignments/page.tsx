import { AssignmentsAdmin } from "@/components/admin/assignments-admin";
import { DashboardFrame } from "@/components/dashboard/dashboard-shell";

export default function AdminAssignmentsPage() {
  return (
    <DashboardFrame
      allowedRoles={["ADMIN", "SUPER_ADMIN"]}
      description="Admin setup for operational hierarchy assignments."
      title="Assignments"
    >
      <AssignmentsAdmin />
    </DashboardFrame>
  );
}
