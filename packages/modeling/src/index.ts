/**
 * OpenSCAD-style modeling API. Function names follow OpenSCAD, but vectors and
 * options are objects (`translate({ z: 5 }, …)`) instead of positional arrays.
 *
 * Nothing here touches geometry: every call builds a plain CSG tree that the
 * kernel evaluates later (`JSON.stringify(shape)` gives the wire format).
 */

import { branded, SHAPE, SHAPE_2D } from './brand';

/**
 * A vector or position where omitted components are 0, e.g. `{ z: 5 }` for straight up.
 * @category Types
 */
export type Vec3 = { x?: number; y?: number; z?: number };
/**
 * A 2D point or size; both components are required.
 * @category Types
 */
export type Vec2 = { x: number; y: number };
/**
 * A 3D size; every component is required.
 * @category Types
 */
export type Size3 = { x: number; y: number; z: number };

type Resolved3 = Required<Vec3>;
type Children = { children: Node[] };

/** Wire format of the CSG tree; mirrored by `Node` in crates/kernel. */
export type Node =
  | { type: 'cube'; size: Resolved3; center: boolean }
  | { type: 'sphere'; r: number }
  | { type: 'cylinder'; h: number; r1: number; r2: number; center: boolean }
  | { type: 'square'; size: Vec2; center: boolean }
  | { type: 'circle'; r: number }
  | { type: 'polygon'; points: Vec2[]; paths?: number[][] }
  | ({ type: 'offset'; r?: number; delta?: number } & Children)
  | ({
      type: 'linear_extrude';
      height: number;
      center: boolean;
      twist?: number;
      scale?: number;
      slices?: number;
    } & Children)
  | ({ type: 'rotate_extrude'; angle?: number } & Children)
  | ({ type: 'translate'; v: Resolved3 } & Children)
  | ({ type: 'rotate'; a: Resolved3 } & Children)
  | ({ type: 'mirror'; v: Resolved3 } & Children)
  | ({ type: 'scale'; v: Resolved3 } & Children)
  | ({ type: 'color'; color: string } & Children)
  | ({ type: 'union' | 'difference' | 'intersection' } & Children)
  | ({ type: 'plugin'; plugin: string; args: Record<string, unknown> } & Children);

/**
 * A solid, as returned by `cube`, `linear_extrude`, `union` and the other 3D operations.
 * Transforms are also available as methods, for chaining: `cube(1).translate({ x: 2 }).color("red")`
 * is `color("red", translate({ x: 2 }, cube(1)))`.
 * @category Types
 */
export class Shape {
  declare private readonly dimensions: 3;
  readonly [SHAPE] = true;

  /** Also recognizes shapes from other copies of this package (e.g. a bundled playground). */
  static [Symbol.hasInstance](value: unknown): boolean {
    return branded(value, SHAPE);
  }
  constructor(readonly node: Node) {}

  toJSON(): Node {
    return this.node;
  }

  translate(v: Vec3): Shape {
    return translate(v, this);
  }

  rotate(a: Vec3): Shape {
    return rotate(a, this);
  }

  mirror(v: Vec3): Shape {
    return mirror(v, this);
  }

  scale(factor: number): Shape {
    return scale(factor, this);
  }

  color(c: string): Shape {
    return color(c, this);
  }
}

/**
 * A 2D shape in the XY plane, as returned by `square`, `circle`, `polygon` and `offset`. It can be
 * moved, mirrored, scaled and offset (also as methods); turn it into a solid with `linear_extrude`
 * or `rotate_extrude`.
 * @category Types
 */
export class Shape2D {
  declare private readonly dimensions: 2;
  readonly [SHAPE_2D] = true;

  /** Also recognizes 2D shapes from other copies of this package. */
  static [Symbol.hasInstance](value: unknown): boolean {
    return branded(value, SHAPE_2D);
  }
  constructor(readonly node: Node) {}

  toJSON(): Node {
    return this.node;
  }

  translate(v: Vec3): Shape2D {
    return translate(v, this);
  }

  rotate(a: Vec3): Shape2D {
    return rotate(a, this);
  }

  mirror(v: Vec3): Shape2D {
    return mirror(v, this);
  }

  scale(factor: number): Shape2D {
    return scale(factor, this);
  }
}

/**
 * A solid or a 2D shape; transforms keep whichever kind they're given.
 * @category Types
 */
export type AnyShape = Shape | Shape2D;

const vec3 = ({ x = 0, y = 0, z = 0 }: Vec3): Resolved3 => ({ x, y, z });
const nodes = (shapes: AnyShape[]) => shapes.map((s) => s.node);
/** Wraps `node` in the kind of its children: 2D in, 2D out. */
const like = <T extends AnyShape>(children: T[], node: Node): T =>
  (children[0] instanceof Shape2D ? new Shape2D(node) : new Shape(node)) as T;

/** OpenSCAD's `$fn`: `segments` points evenly spaced on a circle, starting on +X. */
function regularPolygon(r: number, segments: number): Vec2[] {
  if (!Number.isInteger(segments) || segments < 3)
    throw new Error(`segments must be an integer of at least 3, got ${segments}`);
  return Array.from({ length: segments }, (_, index) => {
    const angle = (2 * Math.PI * index) / segments;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });
}

function positive(name: string, value: number | undefined): number {
  if (value === undefined || !(value >= 0))
    throw new Error(`${name} must be a non-negative number, got ${value}`);
  return value;
}

// ==================== 3D primitives ====================

/**
 * A box with one corner at the origin, or centered on it. A number makes a cube.
 *
 * @example
 * ```ts
 * cube(10)
 * cube({ x: 40, y: 30, z: 20 }, { center: true })
 * ```
 * @category 3D shapes
 */
export function cube(
  size: number | Size3,
  {
    center = false,
  }: {
    /** Center on the origin instead of extending along +X, +Y and +Z. */
    center?: boolean;
  } = {},
): Shape {
  const s = typeof size === 'number' ? { x: size, y: size, z: size } : size;
  return new Shape({
    type: 'cube',
    size: { x: positive('x', s.x), y: positive('y', s.y), z: positive('z', s.z) },
    center,
  });
}

/**
 * A sphere around the origin, by radius or diameter.
 *
 * @example
 * ```ts
 * sphere({ r: 5 })
 * sphere({ d: 10 })
 * ```
 * @category 3D shapes
 */
export function sphere(
  options:
    | {
        /** Radius. */
        r: number;
      }
    | {
        /** Diameter. */
        d: number;
      },
): Shape {
  const r = 'r' in options ? options.r : options.d / 2;
  return new Shape({ type: 'sphere', r: positive('r', r) });
}

export type CylinderOptions = {
  /** Height, along +Z. */
  h: number;
  /** Radius of both ends (default 1). */
  r?: number;
  /** Diameter of both ends. */
  d?: number;
  /** Radius of the bottom; overrides `r`/`d`. */
  r1?: number;
  /** Radius of the top; overrides `r`/`d`. */
  r2?: number;
  /** Diameter of the bottom. */
  d1?: number;
  /** Diameter of the top. */
  d2?: number;
  /** Center on z = 0 instead of starting at z = 0. */
  center?: boolean;
  /** Make a prism with this many sides instead of a round cylinder (OpenSCAD's `$fn`), e.g. 6 for a hex nut trap. */
  segments?: number;
};

/**
 * A cylinder along +Z, or a cone when the radii differ. Radii work like OpenSCAD: `r`/`d` for
 * both ends, `r1`/`d1` (bottom) and `r2`/`d2` (top) to override one.
 *
 * @example
 * ```ts
 * cylinder({ h: 10, r: 2 })
 * cylinder({ h: 5, r1: 4, r2: 2, center: true }) // a truncated cone around z = 0
 * cylinder({ h: 3, d: 6.4, segments: 6 }) // a hexagonal prism
 * ```
 * @category 3D shapes
 */
export function cylinder({
  h,
  r,
  d,
  r1,
  r2,
  d1,
  d2,
  center = false,
  segments,
}: CylinderOptions): Shape {
  const base = r ?? (d === undefined ? undefined : d / 2);
  const bottom = positive('r1', r1 ?? (d1 === undefined ? (base ?? 1) : d1 / 2));
  const top = positive('r2', r2 ?? (d2 === undefined ? (base ?? 1) : d2 / 2));
  if (segments === undefined)
    return new Shape({ type: 'cylinder', h: positive('h', h), r1: bottom, r2: top, center });
  if (bottom === 0 || top === 0)
    throw new Error("cylinder: segments with a pointed end (r1 or r2 = 0) isn't supported yet");
  const scale = top / bottom;
  return linear_extrude(
    { height: h, center, ...(scale === 1 ? {} : { scale }) },
    polygon({ points: regularPolygon(bottom, segments) }),
  );
}

// ==================== 2D primitives ====================

/**
 * A rectangle with one corner at the origin, or centered on it. A number makes a square.
 *
 * @example
 * ```ts
 * square(10)
 * square({ x: 20, y: 10 }, { center: true })
 * ```
 * @category 2D shapes
 */
export function square(
  size: number | Vec2,
  {
    center = false,
  }: {
    /** Center on the origin instead of extending along +X and +Y. */
    center?: boolean;
  } = {},
): Shape2D {
  const s = typeof size === 'number' ? { x: size, y: size } : size;
  return new Shape2D({
    type: 'square',
    size: { x: positive('x', s.x), y: positive('y', s.y) },
    center,
  });
}

/**
 * A circle around the origin, made of one exact arc.
 *
 * @example
 * ```ts
 * circle({ r: 5 })
 * circle({ d: 10 })
 * circle({ r: 5, segments: 6 }) // a hexagon (OpenSCAD's `$fn`), corners on ±X
 * ```
 * @category 2D shapes
 */
export function circle(
  options: (
    | {
        /** Radius. */
        r: number;
      }
    | {
        /** Diameter. */
        d: number;
      }
  ) & {
    /** Make a regular polygon with this many corners instead of a round circle (OpenSCAD's `$fn`). */
    segments?: number;
  },
): Shape2D {
  const r = positive('r', 'r' in options ? options.r : options.d / 2);
  if (options.segments !== undefined)
    return polygon({ points: regularPolygon(r, options.segments) });
  return new Shape2D({ type: 'circle', r });
}

/**
 * A closed polygon. With `paths` (lists of indices into `points`), the first path is the outline
 * and every further path cuts a hole into it.
 *
 * @example
 * ```ts
 * polygon({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }] })
 * // a 10×10 frame with a 6×6 hole
 * polygon({
 *   points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
 *            { x: 2, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 8 }, { x: 2, y: 8 }],
 *   paths: [[0, 1, 2, 3], [4, 5, 6, 7]],
 * })
 * ```
 * @category 2D shapes
 */
export function polygon({
  points,
  paths,
}: {
  /** The corners, in order. */
  points: Vec2[];
  /** Loops of indices into `points`: the first is the outline, further ones are holes. Default: all points in order. */
  paths?: number[][];
}): Shape2D {
  for (const path of paths ?? [points.map((_, index) => index)]) {
    if (path.length < 3)
      throw new Error(`polygon needs at least 3 points per path, got ${path.length}`);
    const bad = path.find(
      (index) => !Number.isInteger(index) || index < 0 || index >= points.length,
    );
    if (bad !== undefined)
      throw new Error(`polygon path index ${bad} is out of range (${points.length} points)`);
  }
  return new Shape2D({
    type: 'polygon',
    points: points.map(({ x, y }) => ({ x, y })),
    ...(paths && { paths: paths.map((p) => [...p]) }),
  });
}

/**
 * Grows (positive) or shrinks (negative) 2D shapes, like OpenSCAD: `r` rounds the corners with
 * exact arcs, `delta` keeps them sharp. Shapes with holes can't be offset yet.
 *
 * @example
 * ```ts
 * offset({ r: 2 }, square(10))
 * offset({ delta: 2 }, square(10))
 * offset({ r: -1 }, polygon({ points: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 0, y: 8 }] }))
 * ```
 * @category 2D shapes
 */
export function offset(
  amount:
    | {
        /** Distance with rounded corners; negative shrinks. */
        r: number;
      }
    | {
        /** Distance with sharp corners; negative shrinks. */
        delta: number;
      },
  ...children: Shape2D[]
): Shape2D {
  const [key, value] =
    'r' in amount ? (['r', amount.r] as const) : (['delta', amount.delta] as const);
  if (!Number.isFinite(value)) throw new Error(`offset: ${key} must be a number, got ${value}`);
  return new Shape2D({ type: 'offset', [key]: value, children: nodes(children) } as Node);
}

// ==================== extrusions ====================

export type LinearExtrudeOptions = {
  /** Height, along +Z. */
  height: number;
  /** Center the result on z = 0 instead of starting at z = 0. */
  center?: boolean;
  /** Degrees the top is turned, clockwise seen from above (like OpenSCAD). */
  twist?: number;
  /** Size of the top relative to the bottom, scaled about the origin; must be greater than 0. */
  scale?: number;
  /** Sections the twisted or scaled surface passes through; defaults to one per 10° of twist. */
  slices?: number;
};

/**
 * Extrudes 2D shapes along +Z into solids, optionally twisting or tapering them.
 *
 * @example
 * ```ts
 * linear_extrude({ height: 10 }, square(5))
 * linear_extrude({ height: 10, scale: 0.5 }, circle({ r: 4 })) // a truncated cone
 * linear_extrude({ height: 20, twist: 90 }, square(6, { center: true }))
 * ```
 * @category Extrusions
 */
export function linear_extrude(
  { height, center = false, twist, scale, slices }: LinearExtrudeOptions,
  ...children: Shape2D[]
): Shape {
  if (scale !== undefined && !(scale > 0))
    throw new Error(`linear_extrude: scale must be greater than 0, got ${scale}`);
  if (slices !== undefined && !(Number.isInteger(slices) && slices >= 1))
    throw new Error(`linear_extrude: slices must be a positive integer, got ${slices}`);
  const extras = {
    ...(twist && { twist }),
    ...(scale !== undefined && scale !== 1 && { scale }),
    ...(slices !== undefined && { slices }),
  };
  return new Shape({
    type: 'linear_extrude',
    height: positive('height', height),
    center,
    ...extras,
    children: nodes(children),
  });
}

/**
 * Spins 2D shapes around the Z axis into solids of revolution, like OpenSCAD: the shape's X is
 * the distance from the axis, its Y the height. Shapes must stay on one side of the axis.
 *
 * @example
 * ```ts
 * rotate_extrude({}, translate({ x: 10 }, circle({ r: 2 }))) // a torus
 * rotate_extrude({ angle: 90 }, translate({ x: 5 }, square({ x: 2, y: 8 }))) // a quarter of a tube
 * ```
 * @category Extrusions
 */
export function rotate_extrude(
  {
    angle,
  }: {
    /** Degrees to sweep, counterclockwise from +X; default 360. */
    angle?: number;
  },
  ...children: Shape2D[]
): Shape {
  if (angle !== undefined && !(angle !== 0 && Math.abs(angle) <= 360))
    throw new Error(`rotate_extrude: angle must be within [-360, 360] and not 0, got ${angle}`);
  return new Shape({
    type: 'rotate_extrude',
    ...(angle !== undefined && angle !== 360 && { angle }),
    children: nodes(children),
  });
}

// ==================== transforms ====================

/**
 * Moves solids or 2D shapes; omitted components are 0. Several children form a group.
 *
 * @example
 * ```ts
 * translate({ x: 5, z: 2 }, cube(1), sphere({ r: 1 }))
 * cube(1).translate({ y: -3 })
 * ```
 * @category Transforms
 */
export function translate<T extends AnyShape>(v: Vec3, ...children: T[]): T {
  return like(children, { type: 'translate', v: vec3(v), children: nodes(children) });
}

/**
 * Rotates by `a` degrees about X, then Y, then Z (OpenSCAD order), around the origin.
 *
 * @example
 * ```ts
 * rotate({ x: 90 }, cylinder({ h: 10, r: 1 })) // now along -Y
 * ```
 * @category Transforms
 */
export function rotate<T extends AnyShape>(a: Vec3, ...children: T[]): T {
  return like(children, { type: 'rotate', a: vec3(a), children: nodes(children) });
}

/**
 * Mirrors across the plane through the origin whose normal is `v`.
 *
 * @example
 * ```ts
 * const wedge = linear_extrude({ height: 4 }, polygon({ points: [{ x: 2, y: 0 }, { x: 10, y: 0 }, { x: 2, y: 6 }] }));
 * mirror({ x: 1 }, wedge) // flips X: right becomes left
 * union(wedge, mirror({ x: 1 }, wedge)) // a symmetric pair
 * ```
 * @category Transforms
 */
export function mirror<T extends AnyShape>(v: Vec3, ...children: T[]): T {
  const n = vec3(v);
  if (n.x === 0 && n.y === 0 && n.z === 0) throw new Error('mirror: the normal must not be zero');
  return like(children, { type: 'mirror', v: n, children: nodes(children) });
}

/**
 * Scales uniformly about the origin. (Per-axis scaling isn't supported yet.)
 *
 * @example
 * ```ts
 * scale(2, cube(5)) // a 10 mm cube
 * ```
 * @category Transforms
 */
export function scale<T extends AnyShape>(factor: number, ...children: T[]): T {
  if (!(factor > 0)) throw new Error(`scale: the factor must be greater than 0, got ${factor}`);
  return like(children, {
    type: 'scale',
    v: { x: factor, y: factor, z: factor },
    children: nodes(children),
  });
}

/**
 * Colors solids with a CSS color name or hex code. Colors show in the viewer and are kept in
 * STEP, GLB and 3MF output.
 *
 * @example
 * ```ts
 * color("tomato", sphere({ r: 5 }))
 * cube(4).color("#3b82f6")
 * ```
 * @category Transforms
 */
export function color(c: string, ...children: Shape[]): Shape {
  return new Shape({ type: 'color', color: c, children: nodes(children) });
}

// ==================== plugins ====================

/**
 * An operation implemented by a plugin (a WebAssembly component, see wit/tscad-plugin.wit). The
 * plugin must be listed in the project's tscad.json; `options` are the plugin's own options.
 *
 * @example
 * ```ts
 * plugin("grid", { nx: 3, ny: 2, dx: 10, dy: 10 }, cylinder({ h: 4, r: 3 }))
 * ```
 * @category Plugins
 */
export function plugin(
  name: string,
  options: Record<string, unknown> = {},
  ...children: Shape[]
): Shape {
  return new Shape({ type: 'plugin', plugin: name, args: options, children: nodes(children) });
}

/**
 * A plugin operation as a typed function, for plugin packages to export (their generated
 * `index.ts` does this). Calls build the same node as `plugin`.
 *
 * @example
 * ```ts
 * const tiles = pluginOperation<{ nx: number; ny: number; dx: number; dy: number }>("grid");
 * tiles({ nx: 3, ny: 2, dx: 10, dy: 10 }, cylinder({ h: 4, r: 3 }))
 * ```
 * @category Plugins
 */
export function pluginOperation<Options extends object>(
  name: string,
): (options: Options, ...children: Shape[]) => Shape {
  return (options, ...children) => plugin(name, options as Record<string, unknown>, ...children);
}

// ==================== booleans ====================

/**
 * Combines solids into one.
 *
 * @example
 * ```ts
 * union(cube(10), translate({ x: 10, y: 5, z: 5 }, sphere({ r: 5 })))
 * ```
 * @category Booleans
 */
export function union(...children: Shape[]): Shape {
  return new Shape({ type: 'union', children: nodes(children) });
}

/**
 * Subtracts every later solid from the first, like OpenSCAD.
 *
 * @example
 * ```ts
 * difference(cube(10, { center: true }), sphere({ r: 6.5 }))
 * difference(cube({ x: 30, y: 20, z: 5 }), translate({ x: 10, y: 10, z: -1 }, cylinder({ h: 7, r: 4 })))
 * ```
 * @category Booleans
 */
export function difference(...children: Shape[]): Shape {
  return new Shape({ type: 'difference', children: nodes(children) });
}

/**
 * Keeps only what all solids share.
 *
 * @example
 * ```ts
 * intersection(cube(10, { center: true }), sphere({ r: 6.5 }))
 * ```
 * @category Booleans
 */
export function intersection(...children: Shape[]): Shape {
  return new Shape({ type: 'intersection', children: nodes(children) });
}

export {
  coerceParameter,
  defineModel,
  describeError,
  evaluateModel,
  Model,
  ParameterError,
  type EvalResult,
  type ModelExport,
  type InferParameters,
  type ParameterJsonSchema,
  type ParameterSchema,
  type ParametersJsonSchema,
} from './model';
