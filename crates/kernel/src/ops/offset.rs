//! `offset` (feature "offset"): OpenSCAD's 2D offset, via the tscad-ext-offset extension crate.

use serde::Deserialize;
use tscad_ext_offset::Join;

use crate::error::{KernelError, Result};
use crate::geometry::{Geometry, loop_count};
use crate::kernel::Evaluator;
use crate::node::Node;

/// `{ r }` rounds corners, `{ delta }` keeps them sharp; positive grows, negative shrinks.
/// Each child profile is offset on its own.
pub fn offset(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	#[serde(deny_unknown_fields)]
	struct Args {
		r: Option<f64>,
		delta: Option<f64>,
	}
	let (distance, join) = match node.args::<Args>()? {
		Args { r: Some(r), delta: None } => (r, Join::Round),
		Args { r: None, delta: Some(delta) } => (delta, Join::Sharp),
		_ => return Err(KernelError::new("expected exactly one of r or delta")),
	};
	let mut profiles = Vec::new();
	for profile in eval.profiles(&node.children)? {
		if loop_count(&profile) > 1 {
			return Err(KernelError::new("shapes with holes can't be offset yet"));
		}
		profiles.extend(tscad_ext_offset::offset(&profile, distance, join).map_err(KernelError::new)?);
	}
	Ok(Geometry::Profiles(profiles))
}
