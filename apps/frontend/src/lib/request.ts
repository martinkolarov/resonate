import { errorResponseSchema, type ErrorPayload } from '@resonate/contracts';

export class HttpError extends Error {
  status: number;
  payload: ErrorPayload | null;

  constructor(status: number, payload: ErrorPayload | null) {
    super(payload?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

export async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, options);
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const { success, data } = errorResponseSchema.safeParse(body);
    let error = null;
    if (success) {
      error = data.error;
    }
    throw new HttpError(response.status, error);
  }

  return body;
}
