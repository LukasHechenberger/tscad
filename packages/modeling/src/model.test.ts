import { expect, test } from 'bun:test';
import * as z from 'zod';
import { cube, defineModel, Model, ParameterError, Shape } from './index';

const model = defineModel({
  parameters: z.object({
    size: z.number().min(1).max(10).default(5).describe('Edge length'),
    centered: z.boolean().default(false),
  }),
  body: ({ size, centered }) => cube(size, { center: centered }),
});

test('builds with defaults and with given values', async () => {
  const shape = await model.build();
  expect(shape.node).toEqual({
    type: 'cube',
    size: { x: 5, y: 5, z: 5 },
    center: false,
  });
  const centered = await model.build({ size: 2, centered: true });
  expect(centered.node).toMatchObject({
    size: { x: 2 },
    center: true,
  });
});

test('describes its parameters as JSON Schema', () => {
  expect(model.parametersJsonSchema().properties).toEqual({
    size: { type: 'number', minimum: 1, maximum: 10, default: 5, description: 'Edge length' },
    centered: { type: 'boolean', default: false },
  });
});

test('reports every invalid parameter by name', async () => {
  const error: unknown = await model
    .build({ size: 11, centered: 'yes' })
    .catch((error: unknown) => error);
  if (!(error instanceof ParameterError)) throw new Error('expected a ParameterError');
  expect(error.issues).toHaveLength(2);
  expect(error.issues[0]).toStartWith('size: ');
  expect(error.issues[1]).toStartWith('centered: ');
});

test('recognizes shapes and models from other copies of the package', () => {
  // What a second copy's instances look like: same brands, different classes.
  const foreignShape = {
    [Symbol.for('@tscad/modeling/Shape')]: true,
    node: { type: 'sphere', r: 1 },
  };
  const foreignModel = { [Symbol.for('@tscad/modeling/Model')]: true };
  expect(foreignShape instanceof Shape).toBe(true);
  expect(foreignModel instanceof Model).toBe(true);
  expect({ node: {} } instanceof Shape).toBe(false);
});
