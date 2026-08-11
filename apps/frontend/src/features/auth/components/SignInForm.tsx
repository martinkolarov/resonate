import { Button, Checkbox, Link } from '@heroui/react';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInRequestSchema, type SignInRequest } from '@resonate/contracts';
import { getServerValidationErrors } from '@/lib/get-server-validation-errors';
import { useToast } from '@/components/ToastProvider';

type SignInFormProps = {
  isSubmitting: boolean;
  onSubmit: (data: SignInRequest) => Promise<void>;
};

export function SignInForm({ isSubmitting, onSubmit }: SignInFormProps) {
  const { toast } = useToast();
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInRequest>({ resolver: zodResolver(signInRequestSchema) });
  const handleValidSubmit = handleSubmit(async data => {
    if (isSubmitting) return;

    try {
      await onSubmit(data);
    } catch (error: unknown) {
      const errors = getServerValidationErrors(error);
      for (const [field, message] of errors) {
        if (field === 'root') {
          toast(message, 'danger', 5000);
        } else {
          setError(field as FieldPath<SignInRequest>, {
            type: 'server',
            message,
          });
        }
      }
    }
  });
  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={handleValidSubmit}>
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
        isDisabled={isSubmitting}
        isLoading={isSubmitting}
      >
        Log In
      </Button>
    </form>
  );
}
