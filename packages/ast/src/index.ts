import * as z from 'zod';

const CoreCuboidNode = z.object({
  type: z.literal('cuboid'),

  size: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
});

const CoreSphereNode = z.object({
  type: z.literal('sphere'),
  radius: z.number(),
});

const CoreSolidNode = z.discriminatedUnion('type', [CoreCuboidNode, CoreSphereNode]);

const CoreBooleanNode = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('union'),
    target: CoreSolidNode,
    tools: z.array(CoreSolidNode),
  }),
]);

const AnyCoreNode = z.discriminatedUnion('type', [CoreSolidNode, CoreBooleanNode]);

console.log({
  cube: AnyCoreNode.parse({
    type: 'union',
    target: {
      type: 'cuboid',
      size: {
        x: 10,
        y: 10,
        z: 10,
      },
    },
    tools: [
      {
        type: 'cuboid',
        size: {
          x: 10,
          y: 10,
          z: 10,
        },
      },
    ],
  }),
});

const CoreModelNode = z.object({
  type: z.literal('@tscad/core/model'),
  parametersJsonSchema: z.looseObject({}),
  body: AnyCoreNode,
});

// MARK: Modeling Helpers

const union = (options: Omit<z.infer<typeof CoreBooleanNode>, 'type'>) => ({
  type: 'union' as const,
  ...options,
});

const cuboid = (options: Omit<z.infer<typeof CoreCuboidNode>, 'type'>) => ({
  type: 'cuboid' as const,
  ...options,
});

const cube = ({
  size,
  ...options
}: Omit<z.infer<typeof CoreCuboidNode>, 'type' | 'size'> & { size: number }) => ({
  type: 'cuboid' as const,
  size: {
    x: size,
    y: size,
    z: size,
  },
  ...options,
});

// MARK: Model Definition and Rendering

function defineModel<P extends z.ZodObject<any>>({
  parameters,
  body,
}: {
  parameters: P;
  body: (params: z.infer<P>) => z.infer<typeof AnyCoreNode>;
}) {
  return {
    type: '@tscad/modeling/model' as const,
    parametersZodSchema: parameters,
    body,
  };
}

type ParametricModel<P extends z.ZodObject<any>> = ReturnType<typeof defineModel<P>>;

const myModel = defineModel({
  parameters: z.object({
    size: z.number().optional().default(10),
  }),
  body: ({ size }) => {
    return union({
      target: cuboid({ size: { x: size, y: size * 2, z: size * 3 } }),
      tools: [cube({ size })],
    });
  },
});

const myRegistry = z.registry<{ description: string }>();

const RenderedModelNode = CoreModelNode.extend({
  parameters: z.optional(
    z.object({
      input: z.looseObject({}),
      output: z.looseObject({}),
    }),
  ),
}).brand('RenderedModelNode');

function renderModel<P extends z.ZodObject<any>>(
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

const rendered = renderModel(myModel, { size: 13 });
const serialized = JSON.stringify(rendered, null, 2);

await Bun.write('out/rendered.json', serialized);
const read = await Bun.file('out/rendered.json').text();
const deserialized = RenderedModelNode.parse(JSON.parse(read));

console.dir({ rendered, deserialized }, { depth: null });
