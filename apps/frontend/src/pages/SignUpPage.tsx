import { Link } from '@heroui/react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { SignUpForm } from '@/features/auth/components/SignUpForm';

export default function SignUpPage() {
  return (
    <AuthShell
      footer={
        <>
          Already have an account?&nbsp;
          <Link href="#" size="sm">
            Log In
          </Link>
        </>
      }
      title="Sign Up"
    >
      <title>Sign up | Resonate</title>
      <SignUpForm />
    </AuthShell>
  );
}
