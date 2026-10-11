// Brands shared by every copy of this package, so `instanceof` works across bundles (e.g. a model
// bundled into the docs playground, evaluated by the playground's own copy).
export const SHAPE = Symbol.for('@tscad/modeling/Shape');
export const SHAPE_2D = Symbol.for('@tscad/modeling/Shape2D');
export const MODEL = Symbol.for('@tscad/modeling/Model');

/** Whether `value` carries `brand`. */
export const branded = (value: unknown, brand: symbol): boolean =>
  typeof value === 'object' && value !== null && brand in value;
