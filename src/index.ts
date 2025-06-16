import { primitives, transforms, colors, booleans } from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';

const { cube, cuboid } = primitives;
const { rotateZ, translate } = transforms;
const { colorize } = colors;
const { subtract, union } = booleans;

const gridfinity = {
  baseplateDimensions: [42, 42] as [number, number],
  baseplateHeight: 5,
};

function pattern(x: number, y: number, callback: (x: number, y: number) => Geom3) {
  return union(
    ...Array.from({ length: x }, (_, i) =>
      Array.from({ length: y }, (_, j) => callback(i, j))
    ).flat()
  );
}

function gridfinityBaseplate({ grid }: { grid: [number, number] }) {
  const height = gridfinity.baseplateHeight;

  // const offset = grid.map((g) => (g * gridfinity.baseplateDimensions[0]) / 2);

  return colorize(
    [1, 0, 0], // Red

    // Baseplate itself
    subtract(
      cuboid({
        size: [
          ...(gridfinity.baseplateDimensions.map((base, i) => grid[i] * base) as [number, number]),
          height,
        ],
      }),

      pattern(grid[0], grid[1], (x, y) => {
        const offset = [
          (-grid[0] / 2 + x + 0.5) * gridfinity.baseplateDimensions[0],
          (-grid[1] / 2 + y + 0.5) * gridfinity.baseplateDimensions[1],
        ] as const;

        return translate(
          [...offset, 0],

          cuboid({
            size: [gridfinity.baseplateDimensions[0] - 5, gridfinity.baseplateDimensions[1] - 5, 5],
          })
        );
      })
    )
  );
}

export function main() {
  return gridfinityBaseplate({ grid: [2, 3] });
}
