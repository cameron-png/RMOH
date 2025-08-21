import { AuthLayout } from '@/components/auth-layout';
import { SignUpForm } from '@/components/signup-form';

export default function SignUpPage() {
  return (
    <AuthLayout title="Create an Account" description="Start by entering your email and password.">
      <SignUpForm />
    </AuthLayout>
  );
}
