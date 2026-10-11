import { evaluateModel, type ModelExport, type Shape } from '@tscad/modeling';

export type ModelOptions = {
  processedModel: ModelExport;
  /** Parameter name → option attribute, as registered by the CLI's preSubcommand hook. */
  parameterOptions?: Record<string, string>;
  [option: string]: unknown;
};

/** Builds the loaded model with the parameter values given as command-line options. */
export async function buildModel({
  processedModel,
  parameterOptions = {},
  ...options
}: ModelOptions): Promise<Shape> {
  const values = Object.fromEntries(
    Object.entries(parameterOptions).map(([name, attribute]) => [name, options[attribute]]),
  );
  const result = await evaluateModel(processedModel, values);
  if (result.error !== undefined) throw new Error(result.error);
  return result.tree;
}
