import {
  authSessionResponseSchema,
  type AuthSessionResponse,
  type SignInRequest,
  type SignUpRequest,
} from '@resonate/contracts';
import { HttpError, request } from '@/lib/request';

export async function signUp(data: SignUpRequest): Promise<void> {
  await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function signIn(data: SignInRequest): Promise<void> {
  await request('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getSession(): Promise<AuthSessionResponse | null> {
  try {
    const body = await request('/api/auth/session', {
      credentials: 'include',
    });
    return authSessionResponseSchema.parse(body);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
