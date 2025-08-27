import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { union } from '@jscad/modeling/src/operations/booleans';
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
type BodyBuilder<T extends ModelType> = (
  parameters: AnyParameters extends T['Parameters'] ? object : ResolvedParameters<T['Parameters']>,
) => Geom3 | Geom3[];

function resolveParameters<Input extends AnyParameters>(
  parameters: Input,
): ResolvedParameters<Input> {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, value]) => [key, value.default]),
  ) as ResolvedParameters<Input>;
}

type ModelOptions<Parameters extends AnyParameters = AnyParameters> = {
  body: BodyBuilder<{ Parameters: Parameters }>;
} & (AnyParameters extends Parameters ? { parameters?: Parameters } : { parameters: Parameters });

function resolveBody<Parameters extends AnyParameters>(options: ModelOptions<Parameters>): Geom3 {
  const result = options.body(resolveParameters(options.parameters ?? ({} as Parameters)));

  return Array.isArray(result) ? union(...result) : result;
}

/** Define a tscad model
 * @see {@link https://tscad.vercel.app/docs/modeling/#defineModel}
 */
export function defineModel<Parameters extends AnyParameters = AnyParameters>(
  options: ModelOptions<Parameters>,
) {
  return resolveBody(options);
}
