import Ajv from 'ajv';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import type { Solid } from './types';

export type * from './types';

const ajv = new Ajv({ useDefaults: true, strict: false, removeAdditional: true });

export type ParametersInput = { [name: string]: Exclude<JSONSchema, boolean> };

type ObjectSchema<Properties extends ParametersInput> = {
  type: 'object';
  additionalProperties: false;
  properties: Properties;
};

export type RenderedModel<Parameters> = {
  parameters: Parameters;
  solids: Solid[];
};

export type Model<S extends ParametersInput, Parameters> = {
  parametersSchema: S;
  resolveParameters(input: Partial<Parameters>, throwIfInvalid?: boolean): Parameters;
  render(input: Partial<Parameters>): RenderedModel<Parameters>;
};

/**
 * Defines a model, including its parameters and model function.
 *
 * @example
 *
 * ```ts
 * import { defineModel } from '@tscad/modeling';
 * import { cube } from '@tscad/modeling/primitives';
 *
 * defineModel({
 *   model: () => cube({ size: 10 }),
 * });
 * ```
 *
 * @example
 *
 * ```ts
 * import { defineModel } from '@tscad/modeling';
 * import { cube } from '@tscad/modeling/primitives';
 *
 * defineModel({
 *   parameters: {
 *     size: { type: 'number', default: 10, minimum: 1 },
 *   },
 * });
 * ```
 *
 * @param modelDefinition - The model definition
 * @see {@link https://tscad.vercel.app/docs/api/modeling/#definemodel | Docs}
 */
export function defineModel<
  S extends ParametersInput = Record<string, never>,
  P = FromSchema<ObjectSchema<S>>,
>(modelDefinition: {
  /** The parameters your model supports. */
  parameters?: S;
  /**
   * The model function
   *
   * @param parameters - The parameters for the model
   */
  model: (parameters: P) => Solid | Solid[];
}): Model<S, P> {
  const { parameters: parametersSchema = {} as S, model } = modelDefinition;
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: parametersSchema,
  } satisfies ObjectSchema<S>;

  const validate = ajv.compile(schema);

  return {
    parametersSchema,
    resolveParameters(input: Partial<P>, throwIfInvalid = true): P {
      if (!validate(input)) {
        if (throwIfInvalid) {
          throw new Error(`Invalid parameters: ${ajv.errorsText(validate.errors)}`);
        } else {
          console.warn(`Invalid parameters: ${ajv.errorsText(validate.errors)}`);
        }
      }

      return input as P;
    },
    render(input: Partial<P>) {
      const parameters = this.resolveParameters(input);
      let solids = model(parameters);

      if (!Array.isArray(solids)) solids = [solids];

      return { parameters, solids };
    },
  };
}
