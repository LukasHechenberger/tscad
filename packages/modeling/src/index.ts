import type { Geom3 } from '@jscad/modeling/src/geometries/types';
export type * from './types';

/** Note: Change during development to adjust the preview */
type ParameterDefault<T> = T extends { default: infer D } ? D : never;
type WithDefault<T> = Omit<T, 'default'> & { default: ParameterDefault<T> };

type AnyParameterDefinition =
  | WithDefault<{ type: 'string'; default: string }>
  | WithDefault<{ type: 'number'; default: number; min?: number; max?: number; step?: number }>;

type ModelType = {
  Parameters: Record<string, AnyParameterDefinition>;
};

type AnyParameters = Record<string, AnyParameterDefinition>;
type ResolvedParameters<Input extends AnyParameters> = {
  [K in keyof Input]: Input[K]['default'];
};
type BodyBuilder<T extends ModelType> = (parameters: ResolvedParameters<T['Parameters']>) => Geom3;

function resolveParameters<Input extends AnyParameters>(
  parameters: Input,
): ResolvedParameters<Input> {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [key, value.default]),
  ) as ResolvedParameters<Input>;
}

export function defineModel(options: { body: BodyBuilder<{ Parameters: {} }> }): Geom3;
export function defineModel<Parameters extends AnyParameters>(options: {
  body: BodyBuilder<{ Parameters: Parameters }>;
}): Geom3;
/** Define a tscad model
 * @see {@link https://tscad.vercel.app/docs/modeling/#defineModel}
 */
export function defineModel<Parameters extends AnyParameters>(options: {
  parameters?: Parameters;
  body: BodyBuilder<{ Parameters: Parameters }>;
}) {
  return options.body(resolveParameters(options.parameters ?? ({} as Parameters)));
}
