//! The raw C ABI, identical for the wasm build (browser, Bun fallback) and the native build
//! (Bun via bun:ffi).
//!
//! A `Session` is a `Kernel` plus an output buffer. Protocol: `alloc` a buffer and copy the JSON
//! tree in; `tscad_eval(session, ptr, len)` frees it and returns a shape handle (≥ 0), or -1 with
//! the error message as output. `tscad_export`/`tscad_mesh`/`tscad_info` return 0 with their result
//! as output, or 1 with an error message. Read output via `tscad_output_ptr`/`tscad_output_len`;
//! it stays valid until the next call on that session.

use std::panic::{AssertUnwindSafe, catch_unwind};

use crate::error::{KernelError, Result};
use crate::export::{Format, export, info, mesh_data};
use crate::kernel::Kernel;
use crate::node::Node;

pub struct Session {
	kernel: Kernel,
	output: Vec<u8>,
}

impl Session {
	/// Runs `f`, storing its result (or error/panic message) as output.
	fn run(&mut self, f: impl FnOnce(&mut Kernel) -> Result<Vec<u8>>) -> u32 {
		match catch_unwind(AssertUnwindSafe(|| f(&mut self.kernel))) {
			Ok(Ok(bytes)) => {
				self.output = bytes;
				0
			}
			Ok(Err(error)) => {
				self.output = error.0.into_bytes();
				1
			}
			Err(panic) => {
				let message = panic.downcast_ref::<String>().cloned().or_else(|| panic.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_else(|| "unknown panic".into());
				self.output = format!("kernel panicked: {message}").into_bytes();
				1
			}
		}
	}
}

/// Runs OCCT's C++ global constructors; must be called once before anything else.
#[cfg(target_arch = "wasm32")]
#[unsafe(no_mangle)]
pub extern "C" fn start() {
	cadrum::__anchor_wasi_stub();
	unsafe extern "C" {
		fn __wasm_call_ctors();
	}
	unsafe { __wasm_call_ctors() };
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
	let mut buf = Vec::<u8>::with_capacity(len);
	let ptr = buf.as_mut_ptr();
	std::mem::forget(buf);
	ptr
}

#[unsafe(no_mangle)]
pub extern "C" fn tscad_session_new() -> *mut Session {
	Box::into_raw(Box::new(Session { kernel: Kernel::new(), output: Vec::new() }))
}

/// # Safety
/// `session` must come from `tscad_session_new` and not be used afterwards.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_session_free(session: *mut Session) {
	drop(unsafe { Box::from_raw(session) });
}

/// # Safety
/// `session` must be live; `ptr`/`len` must come from `alloc` and hold `len` initialized bytes.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_eval(session: *mut Session, ptr: *mut u8, len: usize) -> i32 {
	let session = unsafe { &mut *session };
	let input = unsafe { Vec::from_raw_parts(ptr, len, len) };
	let mut handle = -1;
	let status = session.run(|kernel| {
		let geometry = kernel.evaluate(&Node::parse(&input)?)?;
		if geometry.is_empty() {
			return Err(KernelError::new("model is empty"));
		}
		handle = kernel.insert(geometry) as i32; // handles stay below i32::MAX
		Ok(Vec::new())
	});
	if status == 0 { handle } else { -1 }
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_export(session: *mut Session, handle: u32, format: u32) -> u32 {
	unsafe { &mut *session }.run(|kernel| export(kernel.get(handle)?, Format::from_code(format)?))
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_mesh(session: *mut Session, handle: u32) -> u32 {
	unsafe { &mut *session }.run(|kernel| mesh_data(kernel.get(handle)?))
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_info(session: *mut Session, handle: u32) -> u32 {
	unsafe { &mut *session }.run(|kernel| Ok(info(kernel.get(handle)?)))
}

/// Cache statistics as JSON: `{ "hits", "misses", "entries" }` (always succeeds).
///
/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_stats(session: *mut Session) -> u32 {
	unsafe { &mut *session }.run(|kernel| {
		let stats = kernel.stats();
		Ok(serde_json::to_vec(&serde_json::json!({ "hits": stats.hits, "misses": stats.misses, "entries": stats.entries }))?)
	})
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_release(session: *mut Session, handle: u32) {
	unsafe { &mut *session }.kernel.release(handle);
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_output_ptr(session: *mut Session) -> *const u8 {
	unsafe { &*session }.output.as_ptr()
}

/// # Safety
/// `session` must be live.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn tscad_output_len(session: *mut Session) -> usize {
	unsafe { &*session }.output.len()
}
