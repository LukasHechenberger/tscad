import type { JSONSchema } from 'json-schema-to-ts';

/** A two-dimensional vector */
export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

/** A solid object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Solid = any;

export type ParametersInput = { [name: string]: Exclude<JSONSchema, boolean> };

/** Definitions for a model */
export type ModelDefinition<P> = {
  parametersInput: ParametersInput;
  model: (parameters: P) => Solid | Solid[];
};

export type RenderedModel<P> = {
  /** The parameters (including defaults) used to render the model */
  parameters: P;
  /** The rendered solids */
  solids: Solid[];
};
