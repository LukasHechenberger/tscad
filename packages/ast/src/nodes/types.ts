import type * as z4 from 'zod/v4/core';
import * as z from 'zod';
import type { infer } from 'zod/v4/core';

export type NodeCodex = z4.$ZodCodec<any, any>;

const coreNode = z.union([
  z.object({
    type: z.literal('@tscad/core/model'),
    data: z.object({
      parametersJsonSchema: z.looseObject({
        type: z.any().optional(),
      }), // TODO
    }),
  }),
]);

const modelNode = z.union([
  z.object({
    type: z.literal('@tscad/modeling/model'),
    data: z.object({
      parametersZodSchema: z.instanceof(z.ZodObject),
    }),
  }),
]);

const modelNodeCodec = z.codec(modelNode, coreNode, {
  decode(value) {
    const parametersJsonSchema = value.data.parametersZodSchema.toJSONSchema();

    return {
      type: '@tscad/core/model' as const,
      data: {
        parametersJsonSchema,
      },
    };
  },
  encode(value) {
    throw new Error('Encoding not supported');
  },
});
type OurInput = z.input<typeof modelNodeCodec>;
type OurOutput = z.output<typeof modelNodeCodec>;

type TreeNode<T> = T & { children?: TreeNode<T>[] };

function createTransformer<I extends z.ZodType, O extends z.ZodType>(
  inputNode: I,
  outputNode: O,
  nodeCodec: z.ZodCodec<I, O>,
) {
  const inputTreeNode = z.object({
    node: inputNode,
    get children() {
      return z.array(inputTreeNode);
    },
  });

  const outputTreeNode = z.object({
    node: outputNode,
    get children() {
      return z.array(outputTreeNode);
    },
  });

  const transformerCodec = z.codec<typeof inputTreeNode, typeof outputTreeNode>(
    inputTreeNode,
    outputTreeNode,
    {
      decode({ node, children }) {
        // const parametersJsonSchema = node.data.parametersZodSchema.toJSONSchema();

        const transformedNode = nodeCodec.decode(node);
        const transformedChildren: z.infer<typeof outputTreeNode>[] = children.map((child) =>
          (transformerCodec as z.ZodCodec<typeof inputTreeNode, typeof outputTreeNode>).decode(
            child,
          ),
        );

        return {
          node: transformedNode,
          children: transformedChildren,
        } as z.infer<typeof outputTreeNode>;
      },
      encode() {
        throw new Error('Encoding not supported');
      },
    },
  );

  return transformerCodec.decode.bind(transformerCodec);
}

const modelCodec = z.codec(modelNode, coreNode, {
  decode(node) {
    const parametersJsonSchema = node.data.parametersZodSchema.toJSONSchema();

    return {
      type: '@tscad/core/model' as const,
      data: {
        parametersJsonSchema,
      },
    };
  },
  encode(value) {
    throw new Error('Encoding not supported');
  },
});

const transform = createTransformer(modelNode, coreNode, modelCodec);

// function transform<I extends z4.$ZodObject, O extends z4.$ZodObject>(
//   codec: z.ZodCodec<I, O>,
//   input: z.input<I>,
// ): TreeNode<OurOutput> {
//   const output = codec.decode(input);

//   return {
//     ...output,
//     children: (input.children ?? []).map((child) => transform(codec, child)),
//   };
// }

try {
  const result = transform({
    node: {
      type: '@tscad/modeling/model',
      data: {
        parametersZodSchema: z.object({
          size: z.number().min(1).default(10),
        }),
      },
    },
    children: [
      {
        node: {
          type: '@tscad/modeling/model',
          data: {
            parametersZodSchema: z.object({
              another: z.number().min(1).default(10),
            }),
          },
        },
        children: [],
      },
    ],
  });

  console.log('Parsed result:');
  console.dir(result, { depth: null });
} catch (error) {
  console.error(error);
}
