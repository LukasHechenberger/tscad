import { transforms } from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import type { Vector2, Vector3 } from './vectors';

const { translate } = transforms;

export function pattern(
  { cells, cellSize, center = [0, 0, 0] }: { cells: Vector2; cellSize: Vector2; center?: Vector3 },
  geometry: Geom3,
) {
  const [x, y] = cells;

  return Array.from({ length: x }, (_, index) =>
    Array.from({ length: y }, (_, index_) => {
      const offset = [
        center[0] + (-cells[0] / 2 + index + 0.5) * cellSize[0],
        center[1] + (-cells[1] / 2 + index_ + 0.5) * cellSize[1],
      ] as const;

      return translate([...offset, center[2]], geometry);
    }),
  ).flat();
}
