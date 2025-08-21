
import { AuthLayout } from '@/components/auth-layout';
import { OnboardingForm } from '@/components/onboarding-form';
import { Suspense } from 'react';

function OnboardingPage() {
    return (
        <AuthLayout title="Welcome! Let's set up your profile." description="Add your branding to personalize your account. You can always do this later.">
            <OnboardingForm />
        </AuthLayout>
    )
}


export default function SignUpProfilePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OnboardingPage />
    </Suspense>
  );
}
