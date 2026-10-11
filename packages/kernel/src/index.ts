/** Runtime-agnostic entry (browser): only the wasm kernel. Bun gets ./bun.ts instead. */
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
