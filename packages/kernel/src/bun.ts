/**
 * Bun entry: prefers the native kernel (about 3x faster) and falls back to wasm when no
 * native library was built for this platform. Set TSCAD_KERNEL=wasm|native to force one.
 */

import { suffix } from 'bun:ffi';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Kernel } from './protocol';
import { createWasmKernel } from './wasm';

export { createWasmKernel } from './wasm';
export {
  FORMATS,
  type CacheStats,
  type Format,
  type Kernel,
  type KernelShape,
  type MeshData,
  type ShapeInfo,
} from './protocol';
export { createNativeKernel } from './native';

/** Where `bun run build` (scripts/build.ts) puts the library for the current platform. */
export const nativeLibraryPath = path.join(
  import.meta.dir,
  '../native',
  process.platform === 'win32' ? 'tscad_kernel.dll' : `libtscad_kernel.${suffix}`,
);

export async function loadKernel(prefer = process.env.TSCAD_KERNEL): Promise<Kernel> {
  if (prefer !== 'wasm' && existsSync(nativeLibraryPath)) {
    const { createNativeKernel } = await import('./native');
    return createNativeKernel(nativeLibraryPath);
  }
  if (prefer === 'native')
    throw new Error(
      `no native kernel at ${nativeLibraryPath}; run \`bun run build\` in packages/kernel`,
    );
  return createWasmKernel(await Bun.file(new URL('../kernel.wasm', import.meta.url)).arrayBuffer());
}
