import { DashboardFrame } from "@/components/dashboard/dashboard-shell";
import { DeductionsPage } from "@/components/deductions/deductions-page";

export default function DeductionsRoute() {
  return (
    <DashboardFrame
      allowedRoles={["PICKER", "CHAMP", "AREA_MANAGER", "ADMIN", "SUPER_ADMIN"]}
      description="Operational penalty tracking scoped to your role."
      title="Deductions"
    >
      <DeductionsPage />
    </DashboardFrame>
  );
}
