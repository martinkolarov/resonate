import { Link } from '@heroui/react';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { SignUpForm } from '@/features/auth/components/SignUpForm';
import { signUp } from '@/features/auth/auth.api';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import type { SignUpRequest } from '@resonate/contracts';

export default function SignUpPage() {
  const navigate = useNavigate();
  const signUpMutation = useMutation({
    mutationFn: signUp,
  });

  async function handleSubmit(data: SignUpRequest) {
    await signUpMutation.mutateAsync(data);
    await navigate('/dashboard', { replace: true });
  }

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
      <SignUpForm isSubmitting={signUpMutation.isPending} onSubmit={handleSubmit} />
    </AuthShell>
  );
}
