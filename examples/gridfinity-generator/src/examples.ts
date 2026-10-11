import type { GridfinityBaseplateOptions } from '.';

const sizes = [
  { x: 1, y: 1 },
  { x: 1, y: 2 },
  { x: 1, y: 3 },
  { x: 2, y: 2 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
];

export const examples = [
  ...sizes.map((size) => ({
    title: `Defaults (${size.x}x${size.y})`,
    description: `A simple ${size.x}x${size.y} baseplate with default options.`,
    options: { grid: size },
  })),
  ...sizes.map((size) => ({
    title: `No padding (${size.x}x${size.y})`,
    description: `A simple ${size.x}x${size.y} baseplate with no outer padding.`,
    options: { grid: size, outerPadding: false },
  })),
] satisfies { title: string; description: string; options: GridfinityBaseplateOptions }[];
