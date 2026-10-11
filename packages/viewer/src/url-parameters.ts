import { coerceParameter, type ParametersJsonSchema } from '@tscad/modeling';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Query string with the values that differ from their defaults (so links stay short). */
export function valuesToQuery(
  schema: ParametersJsonSchema,
  values: Record<string, unknown>,
): string {
  const query = new URLSearchParams();
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const value = values[key];
    if (value !== undefined && !same(value, property.default))
      query.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return query.toString();
}

/** Parameter values from a query string, typed by the schema; unknown keys are ignored. */
export function valuesFromQuery(
  schema: ParametersJsonSchema,
  query: string,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, raw] of new URLSearchParams(query)) {
    const property = schema.properties?.[key];
    if (property) values[key] = coerceParameter(raw, property);
  }
  return values;
}
