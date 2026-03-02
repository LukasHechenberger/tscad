import type z from 'zod';
import type { AnyCoreNode, CoreSolidNode } from '..';
import { fuse, box, sphere, unwrap, fuseAll, shape, unwrapErr, isShape3D } from 'brepjs/quick';

export function renderWithBrepjs(node: z.infer<typeof AnyCoreNode>) {
  switch (node.type) {
    case 'union': {
      const target = renderWithBrepjs(node.target);

      console.dir({ isShape3D: isShape3D(target) }, { depth: null });

      const tools = node.tools.map((tool) => renderWithBrepjs(tool));

      return fuseAll([target, ...tools]);
    }
    case 'cuboid': {
      const someBox = box(node.size.x, node.size.y, node.size.z);
      return someBox;
    }
    case 'sphere': {
      const someSphere = sphere(node.radius);
      return someSphere;
    }
    default: {
      throw new Error(`Unsupported node type: ${(node as any).type}`);
    }
  }
}
