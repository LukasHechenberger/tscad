/**
 * Parametric models. Parameters are declared with any schema library implementing Standard
 * Schema (validation) and Standard JSON Schema (introspection), e.g. zod 4.2+, so this package
 * depends on none of them. See https://standardschema.dev.
 */
import { branded, MODEL } from './brand';
import { Shape } from './index';

// ==================== Standard Schema (vendored subset, per the spec's recommendation) ====================

type StandardIssue = {
  readonly message: string;
  readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
};
type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: ReadonlyArray<StandardIssue> };

/** A schema that can both validate values and describe itself as JSON Schema. */
export interface ParameterSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: { readonly input: Input; readonly output: Output };
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>;
    readonly jsonSchema: {
      readonly input: (options: { readonly target: string }) => Record<string, unknown>;
    };
  };
}

/** The validated parameter values a schema produces (defaults applied). */
export type InferParameters<S extends ParameterSchema> = NonNullable<
  S['~standard']['types']
>['output'];

// ==================== models ====================

/** JSON Schema of a model's parameters: an object schema whose properties are the parameters. */
export type ParametersJsonSchema = {
  type?: string;
  properties?: Record<string, ParameterJsonSchema>;
  required?: string[];
  [key: string]: unknown;
};

/** JSON Schema of a single parameter, as far as tools (CLI, viewer form) rely on it. */
export type ParameterJsonSchema = {
  type?: string | string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
};

/**
 * Converts a parameter value given as text (CLI `--set`, URL query) to the type its schema
 * declares. Text that doesn't fit is returned unchanged, so validation reports it.
 */
export function coerceParameter(raw: string, schema: ParameterJsonSchema | undefined): unknown {
  const types = new Set([schema?.type ?? []].flat());
  if (types.has('integer') || types.has('number')) {
    const number = Number(raw);
    return raw.trim() !== '' && !Number.isNaN(number) ? number : raw;
  }
  if (types.has('boolean')) return raw === 'true' ? true : raw === 'false' ? false : raw;
  if (types.has('string')) return raw;
  try {
    return JSON.parse(raw); // untyped: accept JSON literals (arrays, objects), else the string
  } catch {
    return raw;
  }
}

/** Thrown when parameter values don't match the model's schema. */
export class ParameterError extends Error {
  override name = 'ParameterError';
  constructor(readonly issues: string[]) {
    super(`invalid parameters:\n${issues.map((issue) => `  ${issue}`).join('\n')}`);
  }
}

export class Model<S extends ParameterSchema = ParameterSchema> {
  readonly [MODEL] = true;

  /** Also recognizes models from other copies of this package (e.g. a bundled playground). */
  static [Symbol.hasInstance](value: unknown): boolean {
    return branded(value, MODEL);
  }

  constructor(
    readonly parameters: S,
    readonly body: (parameters: InferParameters<S>) => Shape | Promise<Shape>,
  ) {}

  /** The parameters as JSON Schema (draft 2020-12), describing input values with their defaults. */
  parametersJsonSchema(): ParametersJsonSchema {
    return this.parameters['~standard'].jsonSchema.input({
      target: 'draft-2020-12',
    }) as ParametersJsonSchema;
  }

  /** Validates raw values (omitted ones take their defaults); throws `ParameterError` on invalid input. */
  async resolveParameters(values: Record<string, unknown> = {}): Promise<InferParameters<S>> {
    const result = await this.parameters['~standard'].validate(values);
    if (result.issues) {
      throw new ParameterError(
        result.issues.map(({ message, path = [] }) => {
          const key = path
            .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
            .join('.');
          return key ? `${key}: ${message}` : message;
        }),
      );
    }
    return result.value;
  }

  /** Builds the shape for the given raw parameter values. */
  async build(values: Record<string, unknown> = {}): Promise<Shape> {
    return this.body(await this.resolveParameters(values));
  }
}

/**
 * A model with parameters, for use as a model file's default export. Parameters are declared with
 * a schema library implementing [Standard Schema](https://standardschema.dev), such as zod 4.
 * Defaults make the model render as is; `tscad dev` shows a form for the parameters,
 * `tscad export --set size=20` sets them on the command line. `.describe()` text becomes the
 * field's tooltip, `.min()`/`.max()` bound its slider.
 *
 * @example
 * ```ts
 * export default defineModel({
 *   parameters: z.object({
 *     size: z.number().min(1).max(50).default(10).describe("Edge length (mm)"),
 *     rounded: z.boolean().default(true),
 *   }),
 *   body: ({ size, rounded }) => (rounded ? intersection(cube(size, { center: true }), sphere({ r: size * 0.65 })) : cube(size, { center: true })),
 * });
 * ```
 * @category Parameters
 */
export function defineModel<S extends ParameterSchema>(model: {
  parameters: S;
  body: (parameters: InferParameters<S>) => Shape | Promise<Shape>;
}): Model<S> {
  return new Model(model.parameters, model.body);
}

// ==================== evaluation (shared by the preview server and the browser demo) ====================

/** What a model file may export as default: a Shape, a function returning one, or a parametric Model. */
// `any`: a Model's body is contravariant in its typed parameters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ModelExport = Shape | Model<any> | (() => Shape | Promise<Shape>);

export type EvalResult = {
  /** The model's parameters and the values used (defaults applied); absent for plain models. */
  parameters?: { schema: ParametersJsonSchema; values: Record<string, unknown> };
} & ({ tree: Shape; error?: undefined } | { error: string; tree?: undefined });

/**
 * Builds a model export with raw parameter values. Never throws: errors are returned as text,
 * together with the parameter schema when known, so a UI can still offer to fix the values.
 */
export async function evaluateModel(
  exported: ModelExport,
  requested: Record<string, unknown> = {},
): Promise<EvalResult> {
  try {
    if (!(exported instanceof Model)) {
      const shape = typeof exported === 'function' ? await exported() : exported;
      return { tree: shape };
    }
    const schema = exported.parametersJsonSchema();
    // Values for parameters the model doesn't have (any more, after a code edit) are dropped.
    const known = Object.fromEntries(
      Object.entries(requested).filter(([key]) => key in (schema.properties ?? {})),
    );
    try {
      const values = (await exported.resolveParameters(known)) as Record<string, unknown>;
      return { parameters: { schema, values }, tree: await exported.body(values) };
    } catch (error) {
      return { parameters: { schema, values: known }, error: describeError(error) };
    }
  } catch (error) {
    return { error: describeError(error) };
  }
}

/** Error text for users: parameter errors as-is, syntax errors (Bun) with a caret, else the stack. */
export function describeError(error: unknown): string {
  const { position, message, name } = (error ?? {}) as {
    position?: { file: string; line: number; column: number; lineText: string };
    message?: string;
    name?: string;
  };
  if (position) {
    const caret = `${' '.repeat(Math.max(position.column - 1, 0))}^`;
    return `${position.file}:${position.line}:${position.column}: ${message}\n\n  ${position.lineText}\n  ${caret}`;
  }
  if (name === 'ParameterError') return message!;
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
