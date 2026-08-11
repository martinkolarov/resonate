import { Button, Checkbox, Link } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldPath } from 'react-hook-form';
import { Input } from '@/components/Input';
import { PasswordInput } from '@/components/PasswordInput';
import { signUpFormSchema, type SignUpFormValues } from '@/features/auth/auth.schemas';
import { getServerValidationErrors } from '@/lib/get-server-validation-errors';
import { useToast } from '@/components/ToastProvider';
import type { SignUpRequest } from '@resonate/contracts';

type SignUpFormProps = {
  isSubmitting: boolean;
  onSubmit: (data: SignUpRequest) => Promise<void>;
};

export function SignUpForm({ isSubmitting, onSubmit }: SignUpFormProps) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { termsAccepted: false },
  });
  const handleValidSubmit = handleSubmit(async data => {
    if (isSubmitting) return;

    const { email, name, password } = data;

    try {
      await onSubmit({ email, name, password });
    } catch (error: unknown) {
      const errors = getServerValidationErrors(error);
      for (const [field, message] of errors) {
        if (field === 'root') {
          toast(message, 'danger', 5000);
        } else {
          setError(field as FieldPath<SignUpRequest>, {
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
        isRequired
        isInvalid={Boolean(errors.email)}
        errorMessage={errors.email?.message}
        label="Email Address"
        placeholder="Enter your email"
        type="email"
      />
      <Input
        {...register('name')}
        isRequired
        isInvalid={Boolean(errors.name)}
        errorMessage={errors.name?.message}
        label="Name"
        placeholder="Enter your name"
        type="text"
      />
      <PasswordInput
        {...register('password')}
        isRequired
        isInvalid={Boolean(errors.password)}
        errorMessage={errors.password?.message}
        label="Password"
        placeholder="Enter your password"
      />
      <PasswordInput
        {...register('confirmPassword')}
        isRequired
        isInvalid={Boolean(errors.confirmPassword)}
        errorMessage={errors.confirmPassword?.message}
        label="Confirm Password"
        placeholder="Confirm your password"
      />
      <div className="py-4">
        <Checkbox
          {...register('termsAccepted')}
          isRequired
          isInvalid={Boolean(errors.termsAccepted)}
          size="sm"
        >
          I agree with the&nbsp;
          <Link className="relative z-1" href="#" size="sm">
            Terms
          </Link>
          &nbsp; and&nbsp;
          <Link className="relative z-1" href="#" size="sm">
            Privacy Policy
          </Link>
        </Checkbox>
        {errors.termsAccepted && (
          <p className="text-danger mt-1 text-xs">{errors.termsAccepted.message}</p>
        )}
      </div>
      <Button
        color="primary"
        type="submit"
        isDisabled={isSubmitting}
        isLoading={isSubmitting}
      >
        Sign Up
      </Button>
    </form>
  );
}
