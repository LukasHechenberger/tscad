export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

export function mapVector<V extends Vector2 | Vector3>(
  vector: V,
  callback: (value: number, index: number) => number,
): V {
  // eslint-disable-next-line unicorn/no-array-callback-reference -- it's just a typing helper
  return vector.map(callback) as V;
}
