import modeling from '@jscad/modeling';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

const { geom3 } = modeling.geometries;

/** Convert @tscad/modeling geometries to three.js geometries */
export function solidToThree(solid: Geom3): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  const polygons = geom3.toPolygons(solid);

  for (const poly of polygons) {
    const verts = poly.vertices;
    if (verts.length < 3) continue;

    const [v0, ...rest] = verts;

    for (let index = 0; index < rest.length - 1; index++) {
      const v1 = rest[index];
      const v2 = rest[index + 1];

      // Push triangle
      positions.push(...v0!, ...v1!, ...v2!);

      // Compute normal from triangle
      const p0 = new Vector3(...v0!);
      const p1 = new Vector3(...v1!);
      const p2 = new Vector3(...v2!);
      const n = new Vector3()
        .subVectors(p2, p1)
        .cross(new Vector3().subVectors(p0, p1))
        .normalize();

      for (let index = 0; index < 3; index++) normals.push(n.x, n.y, n.z);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
