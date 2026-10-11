import {
  cube,
  cylinder,
  linear_extrude,
  polygon,
  type Shape,
  type Size3,
  translate,
  union,
  type Vec2,
  type Vec3,
} from '@tscad/modeling';

// Specs: https://gridfinity.xyz/specification/

/**
 * A cuboid centered on the origin whose rounded vertical edges slope inwards towards the
 * bottom: `radius` at the top, shrinking by `size.z` (45°) unless `bottomRadius` is given.
 */
export function slopedCuboid({
  size,
  radius: topRadius,
  bottomRadius: _bottomRadius,
}: {
  size: Size3;
  radius: number;
  bottomRadius?: number;
}): Shape {
  const height = size.z;
  const bottomRadius = _bottomRadius ?? topRadius - height;
  const inner = { x: size.x - topRadius * 2, y: size.y - topRadius * 2 };

  return union(
    // Center plate
    cube({ x: inner.x, y: inner.y, z: height }, { center: true }),

    // Corners
    ...corners(inner).map((corner) =>
      translate(corner, cylinder({ h: height, r1: bottomRadius, r2: topRadius, center: true })),
    ),

    // Sloped sides between the corners
    ...[
      { length: inner.y, distance: inner.x },
      { length: inner.x, distance: inner.y },
      { length: inner.y, distance: inner.x },
      { length: inner.x, distance: inner.y },
    ].map(({ length, distance }, index) =>
      linear_extrude(
        { height: length },
        polygon({
          points: [
            { x: 0, y: 0 },
            { x: bottomRadius, y: 0 },
            { x: topRadius, y: height },
            { x: 0, y: height },
          ],
        }),
      )
        .rotate({ x: 90 })
        .translate({ x: distance / 2, y: length / 2, z: -height / 2 })
        .rotate({ z: 90 * index }),
    ),
  );
}

const corners = (inner: Vec2): Vec3[] =>
  [
    { x: 1, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: -1 },
  ].map(({ x, y }) => ({ x: (x * inner.x) / 2, y: (y * inner.y) / 2 }));
