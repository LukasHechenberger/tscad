//! CAD kernel: evaluates CSG trees (produced by `@tscad/modeling`) with cadrum. Built as a native
//! library (Bun, via bun:ffi) and as `wasm32-unknown-unknown` (browser), with the same raw C ABI.
//!
//! - [`Kernel`] is a session: an operation registry, shapes by handle, and a subtree cache that
//!   lives across evaluations (so re-rendering with one changed parameter reuses the rest).
//! - Operations implement [`Operation`]; the built-ins in `ops` are registered like any
//!   extension would be.
//! - [`export`] writes files, [`mesh_data`] raw mesh arrays, [`info`] summary JSON.

mod abi;
mod booleans_util;
mod error;
mod export;
mod geometry;
mod kernel;
mod node;
mod ops;

pub use booleans_util::{as_boolean, clean, union_solids};
pub use error::{KernelError, Result};
pub use export::{Format, export, info, mesh_data};
pub use geometry::{Geometry, Profile};
pub use kernel::{CacheStats, Evaluator, Handle, Kernel, Operation, Uncached};
pub use node::Node;

/// Parses, evaluates and exports a tree in one go, with a fresh kernel.
pub fn render(json: &[u8], format: Format) -> Result<Vec<u8>> {
	export(&Kernel::new().evaluate(&Node::parse(json)?)?, format)
}

#[cfg(test)]
mod tests;
