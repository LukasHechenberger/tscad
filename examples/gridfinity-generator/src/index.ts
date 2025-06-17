import { booleans, colors, extrusions, primitives, transforms } from '@jscad/modeling';
import { pattern } from './lib/modeling';
import { slopedCuboid } from './lib/sloped-cuboid';
import { mapVector, type Vector2, type Vector3 } from './lib/vectors';

// Specs: https://gridfinity.xyz/specification/

const { roundedRectangle } = primitives;
const { translateZ } = transforms;
const { colorize } = colors;
const { subtract, union } = booleans;
const { extrudeLinear } = extrusions;

const gridfinity = {
  baseplateDimensions: [42, 42] as Vector2,
  baseplateHeight: 5,
  baseplatePadding: 2.15,
  baseplateRadius: 4,
};

const baseplateCutout = () =>
  union(
    // Lowest level
    translateZ(
      0 + 0.35, // height so far + half height
      slopedCuboid({
        size: [...mapVector(gridfinity.baseplateDimensions, (d) => d - 2.15 * 2), 0.7],
        radius: 1.85,
      }),
    ),

    // Middle
    translateZ(
      0.7,
      extrudeLinear(
        { height: 1.8 },
        roundedRectangle({
          size: mapVector(gridfinity.baseplateDimensions, (d) => d - 2.15 * 2),
          roundRadius: 1.85,
        }),
      ),
    ),

    // Top level
    translateZ(
      2.5 + 2.15 / 2,
      slopedCuboid({
        size: [...gridfinity.baseplateDimensions, 2.15],
        radius: 4,
      }),
    ),
  );

type GridfinityBaseplateOptions = {
  grid: Vector2;
  /** Override the allover size */
  size?: Vector2 | Vector3;
  /** Add a padding around the gridfinity cutouts. Ignored if `size` is set */
  outerPadding?: boolean;
};

// Tree:
//
// colorize
//   subtract
//     extrudeLinear
//       roundedRectangle
//     pattern
//       cutout (Component/Option ?)
//         union
//           translateZ
//             slopedCuboid
//           translateZ
//             extrudeLinear
//               roundedRectangle
//           translateZ
//             slopedCuboid

export function gridfinityBaseplate({
  grid,
  size: _size,
  outerPadding = true,
}: GridfinityBaseplateOptions) {
  const padding = outerPadding ? gridfinity.baseplatePadding : 0;

  const size: Vector3 = _size
    ? [_size[0], _size[1], _size[2] ?? gridfinity.baseplateHeight]
    : [
        ...mapVector(gridfinity.baseplateDimensions, (dim, index) => dim * grid[index] + padding),
        gridfinity.baseplateHeight,
      ];
  const [width, depth, height] = size;

  console.log({ size });

  const cutout = baseplateCutout();

  return colorize(
    [1, 0, 0], // Red

    subtract(
      // Baseplate itself
      extrudeLinear(
        { height },
        roundedRectangle({
          size: [width, depth],
          center: [0, 0],
          roundRadius: gridfinity.baseplateRadius + padding / 2,
        }),
      ),

      // Cutout for the baseplate
      pattern(
        {
          cells: grid,
          cellSize: gridfinity.baseplateDimensions,

          // 4.65 = Cutout height -> align with the top of the baseplate
          // NOTE: We could use the first two elements to move the cutouts on the plate
          center: [0, 0, height - 4.65],
        },
        cutout,
      ),
    ),
  );
}
