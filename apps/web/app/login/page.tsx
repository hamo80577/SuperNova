import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard
      subtitle="Use your assigned SuperNova credentials."
      title="Sign in"
    >
      <LoginForm />
    </AuthCard>
  );
}
