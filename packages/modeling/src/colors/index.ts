/**
 * Color related functions
 *
 * @remarks
 * Use these functions to apply colors to your 3D objects in the preview etc.
 *
 * <Callout>
 * Be sure to check out the [general modelling guide](/docs/api/modules/modeling) if you're new to tscad
 * </Callout>
 * @packageDocumentation
 * @see {@link https://tscad.vercel.app/docs/api/modules/modeling/colors/#colorize | Docs}
 */

import modeling from '@jscad/modeling';
import type { RGB, RGBA } from '@jscad/modeling/src/colors';
import type { Geometry } from '@jscad/modeling/src/geometries/types';

/**
 * Colorize an object. The color itself is defined as an array of 3 (RGB) or 4 (RGBA) numbers
 * between 0 and 1 corresponding to the red, green, blue, and (optional) alpha channels.
 *
 * @example Coloring an object
 *
 * ```ts
 * import { colorize } from '@tscad/modeling/colors';
 * import { cube } from '@tscad/modeling/primitives';
 *
 * const coloredCube = colorize([1, 0, 0], cube({ size: 10 })); // Red cube
 * ```
 *
 * @param color - The color to apply
 * @param object - The object to colorize
 * @see {@link https://tscad.vercel.app/docs/api/modules/modeling/colors/#colorize | Docs}
 */
export function colorize<T extends Geometry>(color: RGB | RGBA, object: T): T {
  return modeling.colors.colorize(color, object);
}
