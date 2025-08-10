import type { GridfinityBaseplateOptions } from '.';

const sizes = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 2],
  [2, 3],
  [3, 3],
] as [number, number][];

export const examples = [
  ...sizes.map((size) => ({
    title: `Defaults (${size[0]}x${size[1]})`,
    description: `A simple ${size[0]}x${size[1]} baseplate with default options.`,
    options: { grid: size },
  })),
  ...sizes.map((size) => ({
    title: `No padding (${size[0]}x${size[1]})`,
    description: `A simple ${size[0]}x${size[1]} baseplate with no outer padding.`,
    options: { grid: size, outerPadding: false },
  })),
] satisfies { title: string; description: string; options: GridfinityBaseplateOptions }[];
