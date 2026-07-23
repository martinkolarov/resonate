import { signUpRequestSchema } from '@resonate/contracts';
import z from 'zod';

export const signUpFormSchema = signUpRequestSchema
  .extend({
    confirmPassword: z
      .string('Please confirm your password')
      .min(1, 'Please confirm your password'),
    termsAccepted: z
      .boolean()
      .refine(value => value, 'You must accept the terms and privacy policy'),
  })
  .refine(values => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type SignUpFormValues = z.infer<typeof signUpFormSchema>;
