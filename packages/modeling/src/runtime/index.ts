import Ajv from 'ajv';
import type { ModelDefinition, ParametersInput, RenderedModel } from '@/types';

/**
 * Runtime for your models
 *
 * @remarks
 *
 * @packageDocumentation
 */

/** The ajv instance used for validation */
export const ajv = new Ajv({
  useDefaults: true,
  strict: false,
  removeAdditional: true,
  coerceTypes: true,
});

// TODO [>=1.0.0]: Only export as type to avoid instanciating without `getRuntime`

/** A runtime for a model
 *
 * @remarks
 *
 * The ModelRuntime class allows you to use a model definition at runtime. It provides parameter resolution as well as methods for rendering a model.
 */
export class ModelRuntime<P> {
  /**
   * The compiled ajv validation function for the model parameters
   */
  protected validateParameters;

  private constructor(public readonly modelDefinition: ModelDefinition<P>) {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: modelDefinition.parametersInput,
    };

    this.validateParameters = ajv.compile<P>(schema);
  }

  /**
   * Resolves the given input parameters and validates them.
   *
   * @remarks
   *
   * If `throwIfInvalid` is true, an error will be thrown if the parameters are invalid.
   * Otherwise, a warning will be logged to the console.
   *
   * @returns The resolved parameters
   */
  resolveParameters(input: Partial<ParametersInput>, throwIfInvalid = true) {
    if (!this.validateParameters(input)) {
      if (throwIfInvalid) {
        throw new Error(`Invalid parameters: ${ajv.errorsText(this.validateParameters.errors)}`);
      } else {
        // eslint-disable-next-line no-console
        console.warn(`Invalid parameters: ${ajv.errorsText(this.validateParameters.errors)}`);
      }
    }

    return input as P;
  }

  render(input: Partial<P>): RenderedModel<P> {
    const parameters = this.resolveParameters(input as Partial<ParametersInput>);

    let solids = this.modelDefinition.model(parameters);

    if (!Array.isArray(solids)) solids = [solids];

    return { parameters, solids };
  }

  static use<P>(modelDefinition: ModelDefinition<P>) {
    return new ModelRuntime<P>(modelDefinition);
  }
}

/**
 * Use a model definition at runtime
 * @param model - The model definition to use
 */
export function getRuntime<P>(model: ModelDefinition<P>) {
  return ModelRuntime.use(model);
}
