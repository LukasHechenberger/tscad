import z, { url } from 'zod';
import { CoreModelNode, cube, cuboid, defineModel, union } from '..';
import { renderWithBrepjs } from '../renderer/brepjs';
import { exportSTL, unwrap } from 'brepjs/quick';

const myModel = defineModel({
  parameters: z.object({
    size: z.number().optional().default(10),
  }),
  body: ({ size }) => {
    return union({
      target: cuboid({ size: { x: size, y: size * 2, z: size * 3 } }),
      tools: [
        cuboid({ size: { x: size * 4, y: 12, z: 12 } }),
        { type: 'sphere', radius: size * 1.5 },
      ],
    });
  },
});

type ParametricModel<P extends z.ZodObject<any>> = ReturnType<typeof defineModel<P>>;

const RenderedModelNode = CoreModelNode.extend({
  parameters: z.optional(
    z.object({
      input: z.looseObject({}),
      output: z.looseObject({}),
    }),
  ),
  url: z.optional(z.url()),
}).brand('RenderedModelNode');

function resolveModel<P extends z.ZodObject<any>>(
  model: ParametricModel<P>,
  parameters: z.input<P>,
): z.infer<typeof RenderedModelNode> {
  const parsedParameters = model.parametersZodSchema.parse(parameters);

  let body: ReturnType<ParametricModel<P>['body']>;
  let url: string | undefined;
  try {
    body = model.body(parsedParameters);
  } catch (error) {
    // console.log('Got a stack?', model);
    throw error;
  }

  return {
    type: '@tscad/core/model' as const,
    body,
    url,
    parametersJsonSchema: model.parametersZodSchema.toJSONSchema(),
    parameters: {
      input: parameters,
      output: parsedParameters,
    },
    [z.$brand]: { RenderedModelNode: true },
  };
}

function renderModel(model: ReturnType<typeof resolveModel>): z.infer<typeof RenderedModelNode> {
  let url: string | undefined;
  try {
    const brep = unwrap(renderWithBrepjs(model.body));

    const blob = unwrap(exportSTL(brep, { binary: true, tolerance: 0.1, angularTolerance: 1 }));
    url = URL.createObjectURL(blob);

    Bun.write('./out/rendered.stl', blob);
  } catch (error) {
    // console.log('Got a stack?', model);
    throw error;
  }

  return {
    ...model,
    url,
    [z.$brand]: { RenderedModelNode: true },
  };
}

console.time('Resolve Model');
const resolved = resolveModel(myModel, { size: 13 });
console.timeEnd('Resolve Model');

console.time('Render Model');
const rendered = renderModel(resolved);
console.timeEnd('Render Model');

console.time('Render Model Again');
const renderedAgain = renderModel(resolved);
console.timeEnd('Render Model Again');

await Bun.write('./out/rendered.json', JSON.stringify(rendered, null, 2));

// console.dir({ rendered }, { depth: null });
