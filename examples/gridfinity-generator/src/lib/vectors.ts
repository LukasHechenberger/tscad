export type Vector2 = [number, number];
export type Vector3 = [number, number, number];

export function mapVector<V extends Vector2 | Vector3>(
  vector: V,
  callback: (value: number, index: V extends Vector2 ? 0 | 1 : 0 | 1 | 2) => number,
): V {
  return vector.map((v, index) => callback(v, index as V extends Vector2 ? 0 | 1 : 0 | 1 | 2)) as V;
}
