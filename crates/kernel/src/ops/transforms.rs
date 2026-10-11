use cadrum::{Color, DVec3, Edge, Solid};
use serde::Deserialize;

use super::Vec3;
use crate::error::{KernelError, Result};
use crate::geometry::Geometry;
use crate::kernel::Evaluator;
use crate::node::Node;

/// Applies `solid` to every solid and `edge` to every profile edge of the children.
fn map(node: &Node, eval: &mut Evaluator, solid: impl Fn(Solid) -> Solid, edge: impl Fn(Edge) -> Edge) -> Result<Geometry> {
	Ok(match eval.group(&node.children)? {
		Geometry::Solids(solids) => Geometry::Solids(solids.into_iter().map(solid).collect()),
		Geometry::Profiles(profiles) => Geometry::Profiles(profiles.into_iter().map(|p| p.into_iter().map(&edge).collect()).collect()),
	})
}

pub fn translate(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		v: Vec3,
	}
	let Args { v } = node.args()?;
	let v = DVec3::from(v);
	map(node, eval, |s| s.translate(v), |e| e.translate(v))
}

/// Degrees, about X, then Y, then Z (OpenSCAD order).
pub fn rotate(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		a: Vec3,
	}
	let Args { a } = node.args()?;
	let (x, y, z) = (a.x.to_radians(), a.y.to_radians(), a.z.to_radians());
	map(node, eval, |s| s.rotate_x(x).rotate_y(y).rotate_z(z), |e| e.rotate_x(x).rotate_y(y).rotate_z(z))
}

/// Mirrors across the plane through the origin with normal `v`.
pub fn mirror(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		v: Vec3,
	}
	let Args { v } = node.args()?;
	let normal = DVec3::from(v);
	if normal.length() == 0.0 {
		return Err(KernelError::new("the mirror normal must not be zero"));
	}
	map(node, eval, |s| s.mirror(DVec3::ZERO, normal), |e| e.mirror(DVec3::ZERO, normal))
}

/// Scales about the origin. The wire format is a vector, but only uniform factors are supported
/// until a kernel extension provides non-uniform scaling.
pub fn scale(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		v: Vec3,
	}
	let Args { v } = node.args()?;
	if !(v.x == v.y && v.y == v.z) {
		return Err(KernelError::new(format!("non-uniform scaling ({}, {}, {}) isn't supported yet", v.x, v.y, v.z)));
	}
	if !(v.x > 0.0) {
		return Err(KernelError::new(format!("the scale factor must be greater than 0, got {}", v.x)));
	}
	map(node, eval, |s| s.scale(DVec3::ZERO, v.x), |e| e.scale(DVec3::ZERO, v.x))
}

pub fn color(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		color: String,
	}
	let Args { color } = node.args()?;
	// Parsed explicitly: cadrum's `From<&str>` panics on invalid colors.
	let color: Color = color.parse()?;
	Ok(Geometry::Solids(eval.solids(&node.children)?.into_iter().map(|s| s.color(color)).collect()))
}
