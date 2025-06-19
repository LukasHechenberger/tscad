import modeling from '@jscad/modeling';
import type { Vector3 } from '@/types';

const { primitives } = modeling;

/** Options used in the {@link cube} method. */
export interface CubeOptions {
  /** Center of the cube @default [0, 0, 0] */
  center?: Vector3;
  /** Size of the cube @default 2 */
  size?: number;
}

/**
 * Construct an axis-aligned solid cube in three dimensional space with six square faces.
 * @see {@link https://tscad.vercel.app/docs/modeling/primitives/cube}
 */
export function cube(options: CubeOptions) {
  return primitives.cube(options);
}

/**
 * Construct a sphere in three dimensional space where all points are at the same distance from the center.
 * @see {@link https://tscad.vercel.app/docs/modeling/primitives/sphere}
 */
export function sphere(options: primitives.SphereOptions) {
  return primitives.sphere(options);
}
