import modeling from '@jscad/modeling';
import type { RGBA } from '@jscad/modeling/src/colors';
import type { Geometry } from '@jscad/modeling/src/geometries/types';

/** Colorize an object */
export function colorize<T extends Geometry>(color: RGBA, object: T): T {
  return modeling.colors.colorize(color, object);
}
