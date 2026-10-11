import { color, difference, type Size3, translate, union, type Vec2 } from '@tscad/modeling';
import { pattern, roundedBox } from './lib/modeling';
import { slopedCuboid } from './lib/sloped-cuboid';

// Specs: https://gridfinity.xyz/specification/

const gridfinity = {
  baseplateDimensions: { x: 42, y: 42 } satisfies Vec2,
  baseplateHeight: 5,
  baseplatePadding: 2.15,
  baseplateRadius: 4,
};

/** The pocket a bin's foot sits in: three stacked levels, 4.65 high, bottom at z = 0. */
const baseplateCutout = () => {
  const { baseplateDimensions } = gridfinity;
  const inset = { x: baseplateDimensions.x - 2.15 * 2, y: baseplateDimensions.y - 2.15 * 2 };

  return union(
    // Lowest level
    translate(
      { z: 0 + 0.35 }, // height so far + half height
      slopedCuboid({ size: { ...inset, z: 0.7 }, radius: 1.85 }),
    ),

    // Middle
    translate({ z: 0.7 }, roundedBox({ size: inset, height: 1.8, radius: 1.85 })),

    // Top level
    translate(
      { z: 2.5 + 2.15 / 2 },
      slopedCuboid({ size: { ...baseplateDimensions, z: 2.15 }, radius: 4 }),
    ),
  );
};

export type GridfinityBaseplateOptions = {
  grid: Vec2;
  /** Override the allover size */
  size?: Vec2 | Size3;
  /** Add a padding around the gridfinity cutouts. Ignored if `size` is set */
  outerPadding?: boolean;
};

export function gridfinityBaseplate({
  grid,
  size: _size,
  outerPadding = true,
}: GridfinityBaseplateOptions) {
  const padding = outerPadding ? gridfinity.baseplatePadding : 0;

  const size: Size3 = _size
    ? { z: gridfinity.baseplateHeight, ..._size }
    : {
        x: gridfinity.baseplateDimensions.x * grid.x + padding,
        y: gridfinity.baseplateDimensions.y * grid.y + padding,
        z: gridfinity.baseplateHeight,
      };

  return color(
    'red',
    difference(
      // Baseplate itself
      roundedBox({
        size,
        height: size.z,
        radius: gridfinity.baseplateRadius + padding / 2,
      }),

      // Cutout for the baseplate
      ...pattern(
        {
          cells: grid,
          cellSize: gridfinity.baseplateDimensions,

          // 4.65 = Cutout height -> align with the top of the baseplate
          center: { z: size.z - 4.65 },
        },
        baseplateCutout(),
      ),
    ),
  );
}
