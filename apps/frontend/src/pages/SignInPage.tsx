import { Link } from '@heroui/react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { SignInForm } from '@/features/auth/components/SignInForm';

export default function SignInPage() {
  return (
    <AuthShell
      footer={
        <>
          Need to create an account?&nbsp;
          <Link href="#" size="sm">
            Sign Up
          </Link>
        </>
      }
      title="Log In"
    >
      <title>Sign in | Resonate</title>
      <SignInForm />
    </AuthShell>
  );
}
