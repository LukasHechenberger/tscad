import { primitives, transforms, colors, booleans, extrusions } from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { slopedCuboid } from './lib/sloped-cuboid';

// Specs: https://gridfinity.xyz/specification/

const { roundedRectangle } = primitives;
const { translate, translateZ } = transforms;
const { colorize } = colors;
const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;

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

const baseplateCutout = union(
  // Lowest level
  translateZ(
    0 + 0.35, // height so far + half height
    slopedCuboid({
      size: [...(gridfinity.baseplateDimensions.map((d) => d - 2.15 * 2) as [number, number]), 0.7],
      radius: 1.85,
    })
  ),
  // Middle
  translateZ(
    0.7,
    extrudeLinear(
      { height: 1.8 },
      roundedRectangle({
        size: gridfinity.baseplateDimensions.map((d) => d - 2.15 * 2) as [number, number],
        roundRadius: 1.85,
      })
    )
  ),

  // Top level
  translateZ(
    2.5 + 2.15 / 2,
    slopedCuboid({
      size: [...gridfinity.baseplateDimensions, 2.15],
      radius: 4,
    })
  )
);

function gridfinityBaseplate({ grid }: { grid: [number, number] }) {
  return colorize(
    [1, 0, 0], // Red

    subtract(
      // Baseplate itself
      extrudeLinear(
        { height: gridfinity.baseplateHeight },
        roundedRectangle({
          size: gridfinity.baseplateDimensions.map((dim, index) => dim * grid[index]) as [
            number,
            number
          ],
          center: [0, 0],
          roundRadius: 7.5 / 2,
        })
      ),

      // Cutout for the baseplate
      pattern(grid[0], grid[1], (x, y) => {
        const offset = [
          (-grid[0] / 2 + x + 0.5) * gridfinity.baseplateDimensions[0],
          (-grid[1] / 2 + y + 0.5) * gridfinity.baseplateDimensions[1],
        ] as const;

        return translate(
          [...offset, gridfinity.baseplateHeight - 4.65], // Adjust for height
          baseplateCutout
        );
      })
    )
  );
}

export function main() {
  return [gridfinityBaseplate({ grid: [2, 3] })];
}
