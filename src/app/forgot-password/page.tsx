import { AuthLayout } from '@/components/auth-layout';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot Your Password?" description="No problem. Enter your email and we'll send you a reset link.">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
