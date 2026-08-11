import { Link } from '@heroui/react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { SignInForm } from '@/features/auth/components/SignInForm';
import { signIn } from '@/features/auth/auth.api';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { SignInRequest } from '@resonate/contracts';

export default function SignInPage() {
  const navigate = useNavigate();
  const signInMutation = useMutation({
    mutationFn: signIn,
  });

  async function handleSubmit(data: SignInRequest) {
    await signInMutation.mutateAsync(data);
    await navigate('/dashboard', { replace: true });
  }

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
      <SignInForm isSubmitting={signInMutation.isPending} onSubmit={handleSubmit} />
    </AuthShell>
  );
}
