import { linear_extrude, offset, type Shape, square, type Vec2 } from '@tscad/modeling';

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
