import { AuthCard } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function ChangePasswordPage() {
  return (
    <AuthCard
      subtitle="Set a new password before entering the workspace."
      title="Change password"
    >
      <ChangePasswordForm />
    </AuthCard>
  );
}
