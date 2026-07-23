import { HttpError } from '@/lib/request';

export function getServerValidationErrors(response: unknown) {
  const errors: [string, string][] = [];

  if (!(response instanceof HttpError) || !response.payload) {
    return [['root', 'Something went wrong']];
  }

  const error = response.payload;

  if (error.type === 'API_ERROR') {
    return [['root', error.message]];
  }

  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];

    if (message) {
      errors.push([field, message]);
    }
  }

  const formError = error.formErrors[0];

  if (formError) {
    errors.push(['root', formError]);
  }

  return errors;
}
