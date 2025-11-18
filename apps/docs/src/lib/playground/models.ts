import { defineModel } from '@tscad/modeling';
import { colorize } from '@tscad/modeling/colors';
import { cube, sphere } from '@tscad/modeling/primitives';

export default defineModel({
  parameters: {
    size: { type: 'number', default: 10, minimum: 1 },
  },
  model: ({ size }) => [
    cube({ size }),
    colorize(
      [1, 0, 0, 0.9],
      sphere({ radius: size * 0.75, center: [0, size / 2, 0], segments: 64 }),
    ),
  ],
});

export const defaultCode = `
import { defineModel } from '@tscad/modeling';
import { colorize } from '@tscad/modeling/colors';
import { cube, sphere } from '@tscad/modeling/primitives';

export default defineModel({
  parameters: {
    size: { type: 'number', default: 10, minimum: 1 },
  },
  model: ({ size }) => [
    cube({ size }),
    colorize(
      [1, 0, 0, 0.9],
      sphere({ radius: size * 0.75, center: [0, size / 2, 0], segments: 64 }),
    ),
  ],
});
`.trimStart();
