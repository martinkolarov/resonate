import { Button, Checkbox, Link } from '@heroui/react';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInRequestSchema, type SignInRequest } from '@resonate/contracts';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { signIn } from '@/features/auth/auth.api';
import { getServerValidationErrors } from '@/lib/get-server-validation-errors';
import { useToast } from '@/components/ToastProvider';

export function SignInForm() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInRequest>({ resolver: zodResolver(signInRequestSchema) });
  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: () => navigate('/dashboard', { replace: true }),
  });
  const onSubmit = handleSubmit(data => {
    if (signInMutation.isPending) return;

    const { email, password } = data;
    signInMutation.mutate(
      { email, password },
      {
        onError: data => {
          const errors = getServerValidationErrors(data);
          for (const [field, message] of errors) {
            if (field === 'root') {
              toast(message, 'danger', 10000);
            } else {
              setError(field as FieldPath<SignInRequest>, {
                type: 'server',
                message,
              });
            }
          }
        },
      }
    );
  });
  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={onSubmit}>
      <Input
        {...register('email')}
        type="email"
        label="Email Address"
        placeholder="Enter your email"
        isInvalid={Boolean(errors.email)}
        errorMessage={errors.email?.message}
        isRequired
      />
      <PasswordInput
        {...register('password')}
        label="Password"
        name="password"
        placeholder="Enter your password"
        isInvalid={Boolean(errors.password)}
        errorMessage={errors.password?.message}
        isRequired
      />
      <div className="flex items-center justify-between px-1 py-2">
        <Checkbox name="remember" size="sm">
          Remember me
        </Checkbox>
        <Link className="text-default-500" href="#" size="sm">
          Forgot password?
        </Link>
      </div>
      <Button
        color="primary"
        type="submit"
        isDisabled={signInMutation.isPending}
        isLoading={signInMutation.isPending}
      >
        Log In
      </Button>
    </form>
  );
}
