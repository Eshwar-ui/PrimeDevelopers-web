import { ValidationOptions, registerDecorator } from 'class-validator';

export const CONTEXT_MAX_KEYS = 20;
export const CONTEXT_MAX_KEY_LENGTH = 60;
export const CONTEXT_MAX_VALUE_LENGTH = 1000;

/**
 * Why a lead's `context` is invalid, or null when it is fine.
 *
 * QuoteForm.jsx sends a flat object of short form answers — an interior option
 * slug, a desired property, a company name. That is the whole contract, so that is
 * all that is accepted: anything nested, oversized or oddly keyed is not a visitor
 * filling in a form. Until this existed the field was only `@IsObject()`, so an
 * anonymous POST could park up to ~100 kB of arbitrary JSON in every lead row.
 */
export function flatContextProblem(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'must be an object';
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > CONTEXT_MAX_KEYS) return `may have at most ${CONTEXT_MAX_KEYS} fields`;
  for (const [key, v] of entries) {
    if (!/^[A-Za-z0-9_-]+$/.test(key) || key.length > CONTEXT_MAX_KEY_LENGTH) return `has an invalid field name "${key.slice(0, 40)}"`;
    if (typeof v === 'string') {
      if (v.length > CONTEXT_MAX_VALUE_LENGTH) return `field "${key}" is longer than ${CONTEXT_MAX_VALUE_LENGTH} characters`;
    } else if (!(typeof v === 'number' && Number.isFinite(v)) && typeof v !== 'boolean') {
      return `field "${key}" must be text, a number or true/false`;
    }
  }
  return null;
}

export function IsFlatContext(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isFlatContext',
      target: target.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => flatContextProblem(value) === null,
        defaultMessage: (args) => `${args?.property} ${flatContextProblem(args?.value) ?? 'is invalid'}`,
      },
    });
}
