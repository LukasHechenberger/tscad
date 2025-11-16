import modeling from '@jscad/modeling';
import type { RGB, RGBA } from '@jscad/modeling/src/colors';
import type { Geometry } from '@jscad/modeling/src/geometries/types';

/**
 * Color related functions
 *
 * @packageDocumentation
 */

/**
 * Colorize an object. The color itself is defined as an array of 3 (RGB) or 4 (RGBA) numbers
 * between 0 and 1 corresponding to the red, green, blue, and (optional) alpha channels.
 *
 * @param color - The color to apply
 * @param object - The object to colorize
 * @see {@link https://tscad.vercel.app/docs/api/modeling/colors#colorize | Online Documentation}
 */
export function colorize<T extends Geometry>(color: RGB | RGBA, object: T): T {
  return modeling.colors.colorize(color, object);
}
