import { cylinder, defineModel, difference, sphere, translate } from '@tscad/modeling';
import { z } from 'zod';

export default defineModel({
  parameters: z.object({
    size: z.number().min(1).max(50).default(10).describe('Edge length (mm)'),
    hole: z.boolean().default(true),
  }),
  body: ({ size, hole }) =>
    difference(
      sphere({ r: size * 0.75 }).color('tomato'),
      ...(hole ? [cylinder({ h: size * 2, r: size / 4, center: true })] : []),
      translate({ z: size }, cylinder({ h: size, r: size, center: true })),
    ),
});

export const defaultCode = `
import { cylinder, defineModel, difference, sphere, translate } from '@tscad/modeling';
import { z } from 'zod';

export default defineModel({
  parameters: z.object({
    size: z.number().min(1).max(50).default(10).describe('Edge length (mm)'),
    hole: z.boolean().default(true),
  }),
  body: ({ size, hole }) =>
    difference(
      sphere({ r: size * 0.75 }).color('tomato'),
      ...(hole ? [cylinder({ h: size * 2, r: size / 4, center: true })] : []),
      translate({ z: size }, cylinder({ h: size, r: size, center: true })),
    ),
});
`.trimStart();
