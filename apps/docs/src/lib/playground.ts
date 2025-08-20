import { cube, sphere } from '@tscad/modeling/primitives';

export const defaultCode = `import { cube, sphere } from '@tscad/modeling/primitives';

/** Use this method to create your model */
export function main() {
  return [
    cube({ size: 1.5, center: [0, 0.75, 0] }),
    sphere({ radius: 1.2, center: [0, 1.2, 0] }),
  ];
}`;

export const defaultModel = [
  cube({ size: 1.5, center: [0, 0.75, 0] }),
  sphere({ radius: 1.2, center: [0, 1.2, 0] }),
];
