import { dlopen, toArrayBuffer, type Pointer } from 'bun:ffi';
import { createKernel, type Kernel } from './protocol';

/** Loads the native build of the kernel (libtscad_kernel.dylib/.so, tscad_kernel.dll) via bun:ffi. */
const pointer = (address: number) => address as Pointer;

export function createNativeKernel(libraryPath: string): Kernel {
  const { symbols: s } = dlopen(libraryPath, {
    alloc: { args: ['usize'], returns: 'ptr' },
    tscad_session_new: { args: [], returns: 'ptr' },
    tscad_eval: { args: ['ptr', 'ptr', 'usize'], returns: 'i32' },
    tscad_export: { args: ['ptr', 'u32', 'u32'], returns: 'u32' },
    tscad_mesh: { args: ['ptr', 'u32'], returns: 'u32' },
    tscad_info: { args: ['ptr', 'u32'], returns: 'u32' },
    tscad_stats: { args: ['ptr'], returns: 'u32' },
    tscad_release: { args: ['ptr', 'u32'], returns: 'void' },
    tscad_output_ptr: { args: ['ptr'], returns: 'ptr' },
    tscad_output_len: { args: ['ptr'], returns: 'u64' },
  });
  return createKernel('native', {
    alloc: (length) => Number(s.alloc(length)),
    session_new: () => Number(s.tscad_session_new()),
    eval: (session, ptr, length) => s.tscad_eval(pointer(session), pointer(ptr), length),
    export: (session, handle, format) => s.tscad_export(pointer(session), handle, format),
    mesh: (session, handle) => s.tscad_mesh(pointer(session), handle),
    info: (session, handle) => s.tscad_info(pointer(session), handle),
    stats: (session) => s.tscad_stats(pointer(session)),
    release: (session, handle) => s.tscad_release(pointer(session), handle),
    output_ptr: (session) => Number(s.tscad_output_ptr(pointer(session))),
    output_len: (session) => Number(s.tscad_output_len(pointer(session))),
    // Empty outputs have a dangling (non-null) pointer, which toArrayBuffer must not touch.
    view: (ptr, length) =>
      length === 0 ? new Uint8Array() : new Uint8Array(toArrayBuffer(pointer(ptr), 0, length)),
  });
}
