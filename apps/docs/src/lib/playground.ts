import { defineModel } from '@tscad/modeling';
import { colorize } from '@tscad/modeling/colors';
import { cube, sphere } from '@tscad/modeling/primitives';

export const defaultCode = `import { defineModel } from "@tscad/modeling";
import { cube, sphere } from "@tscad/modeling/primitives";
import { colorize } from "@tscad/modeling/colors";

export default defineModel({
  parameters: {
    size: { type: "number", default: 10, minimum: 1 },
  },
  model: ({ size }) => [
    cube({ size }),
    colorize(
      [1, 0, 0, 0.75],
      sphere({ radius: size * 0.75, center: [0, size / 2, 0] })
    ),
  ],
});
`;

export const defaultModel = defineModel({
  parameters: {
    size: { type: 'number', default: 10, minimum: 1 },
  },
  model: ({ size }) => [
    cube({ size }),
    colorize([1, 0, 0, 0.75], sphere({ radius: size * 0.75, center: [0, size / 2, 0] })),
  ],
});
