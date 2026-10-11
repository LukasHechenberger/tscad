import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { cube, cylinder, difference, sphere, translate } from '@tscad/modeling';
import { loadKernel, nativeLibraryPath } from './bun';

/** Volume enclosed by a binary STL mesh (sum of signed tetrahedra). */
function stlVolume(stl: Uint8Array): number {
  const view = new DataView(stl.buffer, stl.byteOffset, stl.byteLength);
  let volume = 0;
  for (let triangle = 0; triangle < view.getUint32(80, true); triangle++) {
    const [a, b, c] = [0, 1, 2].map((vertex) =>
      [0, 1, 2].map((axis) =>
        view.getFloat32(84 + triangle * 50 + 12 + vertex * 12 + axis * 4, true),
      ),
    ) as [number[], number[], number[]];
    volume +=
      (a[0]! * (b[1]! * c[2]! - b[2]! * c[1]!) -
        a[1]! * (b[0]! * c[2]! - b[2]! * c[0]!) +
        a[2]! * (b[0]! * c[1]! - b[1]! * c[0]!)) /
      6;
  }
  return volume;
}

const block = difference(
  cube({ x: 40, y: 30, z: 20 }, { center: true }),
  cylinder({ r: 5, h: 30, center: true }),
  translate({ x: 20, y: 15, z: 10 }, sphere({ r: 8 })),
);
const exact = 40 * 30 * 20 - Math.PI * 25 * 20 - ((4 / 3) * Math.PI * 512) / 8;
// Whichever builds exist: `bun run build` (native), `bun run build:wasm` (wasm, needs Docker).
const backends: ('wasm' | 'native')[] = [
  ...(existsSync(new URL('../kernel.wasm', import.meta.url)) ? (['wasm'] as const) : []),
  ...(existsSync(nativeLibraryPath) ? (['native'] as const) : []),
];

describe.each(backends)('%s kernel', (backend) => {
  test('renders a model close to its exact volume', async () => {
    const kernel = await loadKernel(backend);
    expect(kernel.backend).toBe(backend);
    // Tessellation shrinks the hole slightly, so the mesh is a little larger.
    expect(stlVolume(kernel.render(block, 'stl'))).toBeCloseTo(exact, -2);
    expect(new TextDecoder().decode(kernel.render(block, 'step').slice(0, 13))).toBe(
      'ISO-10303-21;',
    );
    expect(new TextDecoder().decode(kernel.render(block, 'png').slice(1, 4))).toBe('PNG');
  });

  test('evaluates to a shape that can be exported, meshed and queried', async () => {
    const kernel = await loadKernel(backend);
    using shape = kernel.evaluate(cube(2).color('red'));
    const info = shape.info();
    expect(info).toMatchObject({ kind: 'solids', count: 1 });
    expect(info.kind === 'solids' && info.volume).toBeCloseTo(8, 9);

    const mesh = shape.mesh();
    expect(mesh.indices.length / 3).toBe(12); // 6 faces, 2 triangles each
    expect(mesh.triangleFaces.length).toBe(12);
    expect(mesh.positions.length).toBe(mesh.normals.length);
    expect(mesh.faceColors.slice(0, 3)).toEqual(new Float32Array([1, 0, 0]));
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
    expect(shape.export('stl').length).toBe(84 + 12 * 50);
  });

  test("released shapes can't be used", async () => {
    const kernel = await loadKernel(backend);
    const shape = kernel.evaluate(cube(1));
    shape.release();
    expect(() => shape.info()).toThrow('released');
  });

  test('caches subtrees across evaluations', async () => {
    const kernel = await loadKernel(backend);
    kernel.render(block, 'stl');
    const before = kernel.stats();
    kernel.render(translate({ x: 5 }, block), 'stl'); // same difference, moved
    expect(kernel.stats().hits).toBe(before.hits + 1);
    expect(kernel.stats().misses).toBe(before.misses);
  });

  test('reports modeling errors as exceptions', async () => {
    const kernel = await loadKernel(backend);
    expect(() => kernel.render(cube(1).color('not-a-color'), 'stl')).toThrow('kernel: color: ');
    expect(() => kernel.evaluate({ type: 'nope' } as never)).toThrow('unknown operation "nope"');
  });
});

test.if(backends.length === 2)('native and wasm kernels agree', async () => {
  const [wasm, native] = await Promise.all([loadKernel('wasm'), loadKernel('native')]);
  expect(stlVolume(native.render(block, 'stl'))).toBeCloseTo(
    stlVolume(wasm.render(block, 'stl')),
    6,
  );
});
