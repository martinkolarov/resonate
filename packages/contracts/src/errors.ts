import z from 'zod';

export const apiErrorCodeSchema = z.enum([
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'INTERNAL_SERVER_ERROR',
]);

export const apiErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal('API_ERROR'),
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});

export const validationErrorResponseSchema = z.object({
  error: z.object({
    type: z.literal('VALIDATION_ERROR'),
    message: z.string(),
    formErrors: z.array(z.string()),
    fieldErrors: z.record(z.string(), z.array(z.string())),
  }),
});
export const errorResponseSchema = z.union([apiErrorResponseSchema, validationErrorResponseSchema]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ErrorPayload = z.infer<typeof errorResponseSchema>['error'];
