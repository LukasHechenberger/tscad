import { colorize } from '@tscad/modeling/colors';
import { cube, sphere } from '@tscad/modeling/primitives';

export const defaultCode = `import { cube, sphere } from '@tscad/modeling/primitives';
import { colorize } from '@tscad/modeling/colors';

/** Use this method to create your model */
export function main() {
  return [
    sphere({ radius: 1.2, center: [0, 1.2, 0] }),
    colorize(
      // A cube with 75% opacity white color
      [1, 1, 1, 0.75],
      cube({ size: 1.5, center: [0, 0.75, 0] }),
    ),
  ];
}`;

export const defaultModel = [
  sphere({ radius: 1.2, center: [0, 1.2, 0] }),
  colorize(
    // A cube with 75% opacity white color
    [1, 1, 1, 0.75],
    cube({ size: 1.5, center: [0, 0.75, 0] }),
  ),
];
