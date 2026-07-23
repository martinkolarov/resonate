import type { ApiErrorCode } from '@resonate/contracts';
import z from 'zod';

const apiErrorDefinitions = {
  EMAIL_ALREADY_REGISTERED: {
    statusCode: 409,
    message: 'An account with this email already exists',
  },
  INVALID_CREDENTIALS: {
    statusCode: 401,
    message: 'Invalid email or password',
  },
  UNAUTHENTICATED: {
    statusCode: 401,
    message: 'Authentication required',
  },
  INTERNAL_SERVER_ERROR: {
    statusCode: 500,
    message: 'Internal Server Error',
  },
} as const satisfies Record<ApiErrorCode, { statusCode: number; message: string }>;

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode) {
    const definition = apiErrorDefinitions[code];
    super(definition.message);
    this.code = code;
    this.statusCode = definition.statusCode;
  }

  toJSON() {
    return {
      error: {
        type: 'API_ERROR',
        code: this.code,
        message: this.message,
      },
    };
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  formErrors: string[];
  fieldErrors: { [key: string]: string[] };

  constructor(error: z.ZodError) {
    super('Bad Request');
    const { formErrors, fieldErrors } = z.flattenError(error);
    this.formErrors = formErrors;
    this.fieldErrors = fieldErrors;
  }

  toJSON() {
    return {
      error: {
        type: 'VALIDATION_ERROR',
        message: this.message,
        formErrors: this.formErrors,
        fieldErrors: this.fieldErrors,
      },
    };
  }
}
