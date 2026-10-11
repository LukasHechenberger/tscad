/**
 * The kernel's C ABI (crates/kernel/src/abi.rs), shared by its wasm and native builds, wrapped
 * as a typed session: evaluate a model into a shape handle, then export it, read its mesh as
 * arrays, or query it. The session caches evaluated subtrees across evaluations.
 */
import type { Node, Shape } from '@tscad/modeling';

/**
 * Output formats; `png` is a fixed 1024×1024 preview with isometric, top, front and right views,
 * `svg` a single isometric line drawing.
 */
export type Format = 'stl' | 'step' | 'glb' | 'png' | 'svg';
export const FORMATS = ['stl', 'step', 'glb', 'png', 'svg'] as const satisfies readonly Format[];
const FORMAT_CODES: Record<Format, number> = { stl: 0, step: 1, glb: 2, png: 3, svg: 4 };

/** A triangle mesh as flat arrays (see `mesh_data` in crates/kernel/src/export.rs). */
export type MeshData = {
  /** xyz per vertex. */
  positions: Float32Array<ArrayBuffer>;
  /** Unit normal per vertex, from the exact surface. */
  normals: Float32Array<ArrayBuffer>;
  /** Three vertex indices per triangle. */
  indices: Uint32Array<ArrayBuffer>;
  /** B-rep face (0-based, dense) each triangle belongs to. */
  triangleFaces: Uint32Array<ArrayBuffer>;
  /** RGB (0..1) per face; NaN where a face has no color. */
  faceColors: Float32Array<ArrayBuffer>;
  /** B-rep edges as polylines (xyz points), separated by a NaN point. */
  edges: Float32Array<ArrayBuffer>;
};

export type ShapeInfo =
  | {
      kind: 'solids';
      count: number;
      volume: number;
      area: number;
      boundingBox: { min: [number, number, number]; max: [number, number, number] };
    }
  | { kind: 'profiles'; count: number };

export type CacheStats = { hits: number; misses: number; entries: number };

/** A shape kept in the kernel until released (`using shape = kernel.evaluate(…)` releases it automatically). */
export type KernelShape = {
  export(format: Format): Uint8Array<ArrayBuffer>;
  mesh(): MeshData;
  info(): ShapeInfo;
  release(): void;
  [Symbol.dispose](): void;
};

export type Kernel = {
  /** Which build of the kernel is running. */
  readonly backend: 'wasm' | 'native';
  /** Evaluates a shape (or its serialized tree). Throws on modeling errors. */
  evaluate(model: Shape | Node): KernelShape;
  /** Shorthand for evaluate → export → release. */
  render(model: Shape | Node, format: Format): Uint8Array<ArrayBuffer>;
  /** Cumulative subtree cache statistics of this session. */
  stats(): CacheStats;
};

/** The raw exports plus a way to see kernel memory; implemented once per backend. */
export type Abi = {
  alloc(length: number): number;
  session_new(): number;
  eval(session: number, ptr: number, length: number): number;
  export(session: number, handle: number, format: number): number;
  mesh(session: number, handle: number): number;
  info(session: number, handle: number): number;
  stats(session: number): number;
  release(session: number, handle: number): void;
  output_ptr(session: number): number;
  output_len(session: number): number;
  /** A view of `length` bytes of kernel memory at `ptr`, valid until the next kernel call. */
  view(ptr: number, length: number): Uint8Array;
};

export function createKernel(backend: Kernel['backend'], abi: Abi): Kernel {
  const session = abi.session_new();
  const output = () => new Uint8Array(abi.view(abi.output_ptr(session), abi.output_len(session)));
  const text = () => new TextDecoder().decode(output());
  /** Runs a status-returning call (0 = ok) and returns its output, or throws its error message. */
  const call = (status: number) => {
    if (status !== 0) throw new Error(`kernel: ${text()}`);
    return output();
  };

  const kernel: Kernel = {
    backend,
    evaluate(model) {
      const input = new TextEncoder().encode(JSON.stringify(model));
      const ptr = abi.alloc(input.length);
      abi.view(ptr, input.length).set(input);
      const handle = abi.eval(session, ptr, input.length);
      if (handle < 0) throw new Error(`kernel: ${text()}`);
      let released = false;
      const release = () => {
        if (!released) abi.release(session, handle);
        released = true;
      };
      const live = () => {
        if (released) throw new Error('kernel: shape was released');
      };
      const shape = {
        export: (format: Format) => (
          live(),
          call(abi.export(session, handle, FORMAT_CODES[format]))
        ),
        mesh: () => (live(), decodeMesh(call(abi.mesh(session, handle)))),
        info: () => (
          live(),
          JSON.parse(new TextDecoder().decode(call(abi.info(session, handle)))) as ShapeInfo
        ),
        release,
      } as KernelShape;
      // Browsers without explicit resource management lack Symbol.dispose; transpiled `using`
      // then looks for Symbol.for("Symbol.dispose") instead.
      Object.defineProperty(shape, Symbol.dispose ?? Symbol.for('Symbol.dispose'), {
        value: release,
      });
      return shape;
    },
    render(model, format) {
      // try/finally rather than `using`: this also runs in browsers without Symbol.dispose.
      const shape = kernel.evaluate(model);
      try {
        return shape.export(format);
      } finally {
        shape.release();
      }
    },
    stats: () => JSON.parse(new TextDecoder().decode(call(abi.stats(session)))) as CacheStats,
  };
  return kernel;
}

function decodeMesh(bytes: Uint8Array<ArrayBuffer>): MeshData {
  // `bytes` is a fresh copy starting at offset 0, so every section is 4-byte aligned.
  const { buffer } = bytes;
  const [vertices, triangles, faces, edgePoints] = new Uint32Array(buffer, 0, 4) as unknown as [
    number,
    number,
    number,
    number,
  ];
  let offset = 16;
  const take = <T>(
    Type: new (buffer: ArrayBuffer, offset: number, length: number) => T,
    length: number,
  ): T => {
    const array = new Type(buffer, offset, length);
    offset += length * 4;
    return array;
  };
  return {
    positions: take(Float32Array<ArrayBuffer>, vertices * 3),
    normals: take(Float32Array<ArrayBuffer>, vertices * 3),
    indices: take(Uint32Array<ArrayBuffer>, triangles * 3),
    triangleFaces: take(Uint32Array<ArrayBuffer>, triangles),
    faceColors: take(Float32Array<ArrayBuffer>, faces * 3),
    edges: take(Float32Array<ArrayBuffer>, edgePoints * 3),
  };
}
