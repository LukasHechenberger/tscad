/**
 * The host side of `tscad:plugin/kernel` (wit/tscad-plugin.wit) on top of a kernel session.
 * Shapes are lazy CSG trees: composing them only builds a tree, queries evaluate it in the
 * kernel (which caches subtrees, so repeated queries are cheap).
 */

import type { Kernel, ShapeInfo } from '@tscad/kernel';
import type { Node } from '@tscad/modeling';

type Vec3 = { x: number; y: number; z: number };

/** jco maps a thrown `{ payload }` to `err(payload)` for imports returning `result<_, string>`. */
export class PluginCallError extends Error {
  constructor(readonly payload: string) {
    super(payload);
  }
}

const message = (error: unknown) =>
  error instanceof Error ? error.message.replace(/^kernel: /, '') : String(error);

const vector = ([x, y, z]: [number, number, number]) => ({ x, y, z });

export function kernelImports(kernel: Kernel) {
  /** Runs a kernel query on a tree, reporting failures to the plugin as `err`. */
  const query = <T>(node: Node, read: (shape: ReturnType<Kernel['evaluate']>) => T): T => {
    let shape: ReturnType<Kernel['evaluate']> | undefined;
    try {
      shape = kernel.evaluate(node);
      return read(shape);
    } catch (error) {
      throw new PluginCallError(message(error));
    } finally {
      shape?.release();
    }
  };
  const solidInfo = (node: Node) => {
    const info = query(node, (shape) => shape.info());
    if (info.kind !== 'solids') throw new PluginCallError('not a solid (a 2D shape?)');
    return info as Extract<ShapeInfo, { kind: 'solids' }>;
  };
  const wrap = (type: string, extra: object, children: Node[]) =>
    new Shape({ type, ...extra, children } as unknown as Node);

  class Shape {
    constructor(readonly node: Node) {}
    translate(offset: Vec3) {
      return wrap('translate', { v: offset }, [this.node]);
    }
    rotate(degrees: Vec3) {
      return wrap('rotate', { a: degrees }, [this.node]);
    }
    color(color: string) {
      return wrap('color', { color }, [this.node]);
    }
    volume() {
      return solidInfo(this.node).volume;
    }
    area() {
      return solidInfo(this.node).area;
    }
    bounds() {
      const { min, max } = solidInfo(this.node).boundingBox;
      return { min: vector(min), max: vector(max) };
    }
    mesh() {
      const { positions, normals, indices, triangleFaces, faceColors } = query(this.node, (shape) =>
        shape.mesh(),
      );
      return { positions, normals, indices, triangleFaces, faceColors };
    }
  }

  const nodes = (shapes: Shape[]) => shapes.map((shape) => shape.node);
  return {
    Shape,
    node(json: string) {
      try {
        return new Shape(JSON.parse(json));
      } catch (error) {
        throw new PluginCallError(`invalid node JSON: ${message(error)}`);
      }
    },
    union: (shapes: Shape[]) => wrap('union', {}, nodes(shapes)),
    difference: (base: Shape, cut: Shape[]) => wrap('difference', {}, [base.node, ...nodes(cut)]),
    intersection: (shapes: Shape[]) => wrap('intersection', {}, nodes(shapes)),
  };
}

export type KernelImports = ReturnType<typeof kernelImports>;
export type HostShape = InstanceType<KernelImports['Shape']>;
