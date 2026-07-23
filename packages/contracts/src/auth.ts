import z from 'zod';

export const signInRequestSchema = z.object({
  email: z.email('Invalid email').min(1, 'Email is required'),
  password: z.string('Password is required').min(1, 'Password is required'),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const signUpRequestSchema = z.object({
  email: z.email('Invalid email').min(1, 'Email is required'),
  name: z.string('Invalid name').min(1, 'Name is required'),
  password: z.string('Password is required').min(1, 'Password is required'),
});

export type SignUpRequest = z.infer<typeof signUpRequestSchema>;

export const authSessionResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email(),
    name: z.string(),
  }),
});

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
