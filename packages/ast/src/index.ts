import * as z from 'zod';

// MARK: Node schemas

const stackField = z.optional(z.string()).meta({ description: 'Used to improve error reporting' });

const CoreCuboidNode = z.object({
  type: z.literal('cuboid'),
  size: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  stack: stackField,
});

const CoreSphereNode = z.object({
  type: z.literal('sphere'),
  radius: z.number(),
  stack: stackField,
});

export const CoreSolidNode = z.discriminatedUnion('type', [CoreCuboidNode, CoreSphereNode]);

export type AnyCoreNode =
  | z.infer<typeof CoreCuboidNode>
  | z.infer<typeof CoreSphereNode>
  | { type: 'union'; target: AnyCoreNode; tools: AnyCoreNode[]; stack?: string };

export const AnyCoreNode: z.ZodType<AnyCoreNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    CoreCuboidNode,
    CoreSphereNode,
    z.object({
      type: z.literal('union'),
      target: AnyCoreNode,
      tools: z.array(AnyCoreNode),
      stack: stackField,
    }),
  ]),
);

export const CoreModelNode = z.object({
  type: z.literal('@tscad/core/model'),
  parametersJsonSchema: z.looseObject({}),
  body: AnyCoreNode,
});

// MARK: Modeling helpers

export const union = (options: { target: AnyCoreNode; tools: AnyCoreNode[] }) => {
  const stack = new Error().stack?.split('\n').slice(2).join('\n');
  return { type: 'union' as const, stack, ...options };
};

export const cuboid = (options: Omit<z.infer<typeof CoreCuboidNode>, 'type' | 'stack'>) => {
  const stack = new Error().stack?.split('\n').slice(2).join('\n');
  return { type: 'cuboid' as const, stack, ...options };
};

export const cube = ({
  size,
  ...options
}: Omit<z.infer<typeof CoreCuboidNode>, 'type' | 'size' | 'stack'> & { size: number }) =>
  cuboid({ size: { x: size, y: size, z: size }, ...options });

// MARK: Model layer

export { defineModel, renderModel, RenderedModelNode } from './model';
