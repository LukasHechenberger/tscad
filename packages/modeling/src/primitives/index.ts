/**
 * Methods to construct simple geometric primitives
 *
 * @remarks
 *
 * <Callout>
 * Be sure to check out the [general modelling guide](/docs/api/modules/modeling) if you're new to tscad
 * </Callout>
 *
 * @packageDocumentation
 */

import modeling from '@jscad/modeling';
import type { Vector3 } from '@/types';

const { primitives } = modeling;

/** Options used in the {@link cube} method. */
export interface CubeOptions {
  /**
   * Center of the cube
   *
   * @defaultValue [0, 0, 0]
   */
  center?: Vector3;
  /**
   * Size of the cube
   *
   * @defaultValue 2
   */
  size?: number;
}

/**
 * Construct an axis-aligned solid cube in three dimensional space with six square faces.
 *
 * @param options - Options for the cube
 * @see {@link https://tscad.vercel.app/docs/api/modules/modeling/primitives#cube | Docs}
 */
export function cube(options: CubeOptions) {
  return primitives.cube(options);
}

/**
 * Construct a sphere in three dimensional space where all points are at the same distance from the
 * center.
 *
 * @param options - Options for the sphere
 * @see {@link https://tscad.vercel.app/docs/api/modules/modeling/primitives#sphere | Docs}
 */
export function sphere(options: primitives.SphereOptions) {
  return primitives.sphere(options);
}
