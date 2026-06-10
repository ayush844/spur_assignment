import { type ZodError, type ZodType } from 'zod';

export function formatZodError(error: ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request.';
}

export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
