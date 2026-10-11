/** Node entry: the wasm kernel, read from this package's kernel.wasm. */

import { readFile } from 'node:fs/promises';
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

/** Loads the wasm kernel from a file path or URL (default: kernel.wasm in this package). */
export async function loadKernel(
  source: string | URL = new URL('../kernel.wasm', import.meta.url),
): Promise<Kernel> {
  const url = source instanceof URL ? source : URL.canParse(source) ? new URL(source) : undefined;
  if (url && url.protocol !== 'file:') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load the kernel from ${url}: ${response.status}`);
    return createWasmKernel(await response.arrayBuffer());
  }
  return createWasmKernel(await readFile(url ?? source));
}
