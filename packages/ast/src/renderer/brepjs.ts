import type { Result, Shape3D } from 'brepjs';
import type { AnyCoreNode } from '..';
import { ok, unwrap, box, sphere, fuseAll } from 'brepjs/quick';

export function renderWithBrepjs(node: AnyCoreNode): Result<Shape3D> {
  switch (node.type) {
    case 'union': {
      const shapes = [node.target, ...node.tools].map((n) => unwrap(renderWithBrepjs(n)));
      return fuseAll(shapes);
    }
    case 'cuboid': {
      return ok(box(node.size.x, node.size.y, node.size.z));
    }
    case 'sphere': {
      return ok(sphere(node.radius));
    }
    default: {
      throw new Error(`Unsupported node type: ${(node as any).type}`);
    }
  }
}
