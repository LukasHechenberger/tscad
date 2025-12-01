/**
 * Methods to model your 3d model
 *
 * @remarks
 * Use `@tscad/modeling` to define your 3d models.
 *
 * <Callout>
 *
 * **This is probably the most important package of tscad.**
 *
 * </Callout>
 *
 * ## Introduction
 *
 * Usually a model is made up of a function that generates geometry (the "model function") and a set
 * of parameters that control how the model is generated.
 *
 * ```ts twoslash
 * import { defineModel } from '@tscad/modeling';
 *
 * export default defineModel({
 *   // [!code highlight]
 *   model: () => {},
 * });
 * ```
 *
 * A model function usually combines a few primitives from [`@tscad/modeling/primitives`](/docs/api/modules/modeling/primitives) to create a
 * model body.
 *
 * ```ts twoslash
 * import { defineModel } from '@tscad/modeling';
 * import { cube, sphere } from '@tscad/modeling/primitives'; // [!code ++]
 *
 * export default defineModel({
 *   model: () => {
 *     // create some solids // [!code ++]
 *     const base = cube({ size: 10 }); // [!code ++]
 *     const top = sphere({ radius: 5, center: [5, 5, 10] }); // [!code ++]
 *     // [!code ++]
 *     // return the model's solids // [!code ++]
 *     return [base, top]; // [!code ++]
 *   },
 * });
 * ```
 *
 * If you want to customize how the model appears in the preview, you can colorize it using
 * [`@tscad/modeling/colors`](/docs/api/modules/modeling/colors).
 *
 * ```ts twoslash
 * import { defineModel } from '@tscad/modeling';
 * import { cube, sphere } from '@tscad/modeling/primitives';
 * import { colorize } from '@tscad/modeling/colors';
 *
 * // ---cut---
 * export default defineModel({
 *   model: () => {
 *     const base = cube({ size: 10 });
 *     const top = sphere({ radius: 5, center: [5, 5, 10] });
 *
 *     return [
 *       base,
 *       // [!code ++]
 *       colorize(
 *         [1, 0, 0], // red // [!code ++]
 *         top,
 *       ),
 *     ];
 *   },
 * });
 * ```
 *
 * Additionally, models can define parameters to make them more flexible.
 *
 * ```ts twoslash
 * import { defineModel } from '@tscad/modeling';
 * import { cube, sphere } from '@tscad/modeling/primitives';
 * import { colorize } from '@tscad/modeling/colors';
 *
 * // ---cut---
 * export default defineModel({
 *   // [!code ++]
 *   parameters: {
 *     // [!code ++]
 *     size: { type: 'number', default: 10, minimum: 1 }, // [!code ++]
 *   }, // [!code ++]
 *   // [!code word:size]
 *   model: ({ size }) => {
 *     const base = cube({ size });
 *     const top = sphere({ radius: 5, center: [5, 5, 10] });
 *
 *     return [base, colorize([1, 0, 0], top)];
 *   },
 * });
 * ```
 * @packageDocumentation
 */

import type { FromSchema } from 'json-schema-to-ts';
import type { ModelDefinition, ParametersInput, Solid } from './types';

type ObjectSchema<Properties extends ParametersInput> = {
  type: 'object';
  additionalProperties: false;
  properties: Properties;
};

/**
 * Defines a model, including its parameters and model function.
 *
 * @example
 *
 * Simple Model
 *
 * ```ts twoslash
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
 * Model with Parameters
 *
 * ```ts
 * import { defineModel } from '@tscad/modeling';
 * import { cube } from '@tscad/modeling/primitives';
 *
 * defineModel({
 *   parameters: {
 *     size: { type: 'number', default: 10, minimum: 1 },
 *   },
 *   model: ({ size }) => cube({ size }),
 * });
 * ```
 *
 * @param model - The model definition
 * @see {@link https://tscad.vercel.app/docs/api/modules/modeling/#definemodel | Docs}
 */
export function defineModel<
  S extends ParametersInput = Record<string, never>,
  P = FromSchema<ObjectSchema<S>>,
>(model: {
  /** The parameters your model supports. */
  parameters?: S;
  /**
   * The model function
   *
   * @param parameters - The parameters for the model
   */
  model: (parameters: P) => Solid | Solid[];
}): ModelDefinition<P> {
  return { parametersInput: model.parameters ?? {}, model: model.model };
}

export type * from './types';
