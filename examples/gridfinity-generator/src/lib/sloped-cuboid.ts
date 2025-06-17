import { primitives, transforms, colors, booleans, extrusions } from '@jscad/modeling';

// Specs: https://gridfinity.xyz/specification/

const { cube, cuboid, polygon, roundedRectangle, circle, triangle, cylinderElliptic } = primitives;
const { rotateZ, rotateX, rotate, rotateY, translate, translateZ, mirror } = transforms;
const { colorize } = colors;
const { subtract, union } = booleans;
const { extrudeLinear, extrudeHelical, extrudeRectangular, extrudeRotate } = extrusions;

/** A rounded Cuboid, that has a sloped */
export function slopedCuboid({
  size,
  radius: topRadius,
  bottomSize: _bottomSize,
  bottomRadius: _bottomRadius,
}: {
  size: [number, number, number];
  radius: number;
  bottomSize?: [number, number];
  bottomRadius?: number;
}) {
  const height = size[2];
  const bottomRadius = _bottomRadius ?? topRadius - height;
  const topSize = [size[0], size[1]];
  const innerSize = [
    (_bottomSize?.[0] ?? topSize[0]) - topRadius * 2,
    (_bottomSize?.[1] ?? topSize[1]) - topRadius * 2,
  ];

  return [
    union(
      // Center plate
      cuboid({ size: [innerSize[0], innerSize[1], height] }),

      // Corners
      ...[
        [1, 1],
        [-1, 1],
        [-1, -1],
        [1, -1],
      ].map((offset) =>
        translate(
          // [0, 0, 0],
          offset.map((o, i) => (o * innerSize[i]) / 2) as [number, number],
          cylinderElliptic({
            height,
            startRadius: [bottomRadius, bottomRadius],
            endRadius: [topRadius, topRadius],
          }),
        ),
      ),

      // Connections between edges
      ...[
        { length: innerSize[1], offset: innerSize[0] },
        { length: innerSize[0], offset: innerSize[1] },
        { length: innerSize[1], offset: innerSize[0] },
        { length: innerSize[0], offset: innerSize[1] },
      ].map(({ length, offset }, index) =>
        rotateZ(
          (Math.PI / 2) * index, // Rotate to align with the X-axis
          translate(
            [offset / 2, length / 2, -height / 2],
            rotateX(
              Math.PI / 2,
              extrudeLinear(
                { height: length },
                polygon({
                  points: [
                    [0, 0],
                    [bottomRadius, 0],
                    [topRadius, height],
                    [0, height],
                  ],
                }),
              ),
            ),
          ),
        ),
      ),
    ),
  ];
}
