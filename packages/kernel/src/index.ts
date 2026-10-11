/**
 * Browser (and default) entry: the wasm kernel. Node gets ./node.ts, Bun ./bun.ts, with the same
 * `loadKernel()`.
 */

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

/**
 * Loads the wasm kernel. By default from kernel.wasm in this package: bundlers such as Vite,
 * webpack and Turbopack emit it as an asset because of the `new URL(…, import.meta.url)` pattern.
 * Pass a URL to load it from elsewhere, e.g. a CDN.
 */
export async function loadKernel(
  source: string | URL = new URL('../kernel.wasm', import.meta.url),
): Promise<Kernel> {
  // Bundlers may rewrite the default: into a root-relative path, a URL-like object (Turbopack), or
  // a URL resolved against a file: URL (Turbopack, in workers). In a browser, resolve such paths
  // against the page: its origin, for workers created from a blob URL.
  const location = (globalThis as { location?: Location }).location;
  const base = location && (location.protocol === 'blob:' ? location.origin : location.href);
  let url = URL.canParse(String(source)) ? new URL(String(source)) : new URL(String(source), base);
  if (base && url.protocol === 'file:') url = new URL(url.pathname, base);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load the kernel from ${source}: ${response.status}`);
  return createWasmKernel(await response.arrayBuffer());
}
