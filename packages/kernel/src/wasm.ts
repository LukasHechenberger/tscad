import { createKernel, type Kernel } from './protocol';

type WasmExports = {
  memory: WebAssembly.Memory;
  start(): void;
  alloc(length: number): number;
  tscad_session_new(): number;
  tscad_eval(session: number, ptr: number, length: number): number;
  tscad_export(session: number, handle: number, format: number): number;
  tscad_mesh(session: number, handle: number): number;
  tscad_info(session: number, handle: number): number;
  tscad_stats(session: number): number;
  tscad_release(session: number, handle: number): void;
  tscad_output_ptr(session: number): number;
  tscad_output_len(session: number): number;
};

/** Instantiates kernel.wasm; works in any runtime with WebAssembly (browser, Bun, Node). */
export async function createWasmKernel(bytes: ArrayBuffer | Uint8Array): Promise<Kernel> {
  // cadrum's wasm has zero imports: its WASI stubs are linked in.
  // A Uint8Array over an ArrayBuffer, so the (BufferSource) overload returning the instance applies.
  const { instance } = await WebAssembly.instantiate(new Uint8Array(bytes), {});
  const wasm = instance.exports as unknown as WasmExports;
  wasm.start(); // runs OCCT's C++ static constructors
  return createKernel('wasm', {
    alloc: wasm.alloc,
    session_new: wasm.tscad_session_new,
    eval: wasm.tscad_eval,
    export: wasm.tscad_export,
    mesh: wasm.tscad_mesh,
    info: wasm.tscad_info,
    stats: wasm.tscad_stats,
    release: wasm.tscad_release,
    output_ptr: wasm.tscad_output_ptr,
    output_len: wasm.tscad_output_len,
    // Re-read memory.buffer on every call: growing memory detaches the old buffer.
    view: (ptr, length) => new Uint8Array(wasm.memory.buffer, ptr, length),
  });
}
