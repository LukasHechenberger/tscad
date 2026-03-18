import * as z from 'zod';
import { AnyCoreNode, CoreModelNode } from '.';

export function defineModel<P extends z.ZodObject<any>>({
  parameters,
  body,
}: {
  parameters: P;
  body: (params: z.infer<P>) => AnyCoreNode;
}) {
  return {
    type: '@tscad/modeling/model' as const,
    parametersZodSchema: parameters,
    body,
  };
}

type ParametricModel<P extends z.ZodObject<any>> = ReturnType<typeof defineModel<P>>;

export const RenderedModelNode = CoreModelNode.extend({
  parameters: z.optional(
    z.object({
      input: z.looseObject({}),
      output: z.looseObject({}),
    }),
  ),
}).brand('RenderedModelNode');

export function renderModel<P extends z.ZodObject<any>>(
  model: ParametricModel<P>,
  parameters: z.input<P>,
): z.infer<typeof RenderedModelNode> {
  const parsedParameters = model.parametersZodSchema.parse(parameters);
  const body = model.body(parsedParameters);

  return {
    type: '@tscad/core/model' as const,
    body,
    parametersJsonSchema: model.parametersZodSchema.toJSONSchema(),
    parameters: {
      input: parameters,
      output: parsedParameters,
    },
    [z.$brand]: { RenderedModelNode: true },
  };
}
