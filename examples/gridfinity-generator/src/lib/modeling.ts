import {
  linear_extrude,
  offset,
  type Shape,
  square,
  translate,
  type Vec2,
  type Vec3,
} from '@tscad/modeling';

/** Copies of `shape`, one per cell of a `cells.x` × `cells.y` grid centered on `center`. */
export function pattern(
  { cells, cellSize, center = {} }: { cells: Vec2; cellSize: Vec2; center?: Vec3 },
  shape: Shape,
): Shape[] {
  const { x = 0, y = 0, z = 0 } = center;

  return Array.from({ length: cells.x }, (_, column) =>
    Array.from({ length: cells.y }, (_, row) =>
      translate(
        {
          x: x + (-cells.x / 2 + column + 0.5) * cellSize.x,
          y: y + (-cells.y / 2 + row + 0.5) * cellSize.y,
          z,
        },
        shape,
      ),
    ),
  ).flat();
}

/** A box with rounded vertical edges, from z = 0 to `height`, centered in XY. */
export function roundedBox({
  size,
  height,
  radius,
}: {
  size: Vec2;
  height: number;
  radius: number;
}): Shape {
  // OpenSCAD's idiom: grow a smaller square by `radius` with round joins (exact arcs).
  const inner = square({ x: size.x - radius * 2, y: size.y - radius * 2 }, { center: true });
  return linear_extrude({ height }, radius > 0 ? offset({ r: radius }, inner) : inner);
}
