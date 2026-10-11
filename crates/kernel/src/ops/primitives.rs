use cadrum::{DVec3, Edge, Solid};
use serde::Deserialize;

use super::{Vec2, Vec3};
use crate::error::{KernelError, Result};
use crate::geometry::Geometry;
use crate::kernel::Evaluator;
use crate::node::Node;

pub fn cube(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		size: Vec3,
		center: bool,
	}
	let Args { size, center } = node.args()?;
	let size = DVec3::from(size);
	let min = if center { -size / 2.0 } else { DVec3::ZERO };
	Ok(Geometry::Solids(vec![Solid::cube(min, min + size)]))
}

pub fn sphere(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		r: f64,
	}
	let Args { r } = node.args()?;
	Ok(Geometry::Solids(vec![Solid::sphere(r)]))
}

pub fn cylinder(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		h: f64,
		r1: f64,
		r2: f64,
		center: bool,
	}
	let Args { h, r1, r2, center } = node.args()?;
	let solid = if r1 == r2 { Solid::cylinder(r1, DVec3::Z * h) } else { Solid::cone(r1, r2, DVec3::Z * h) };
	Ok(Geometry::Solids(vec![if center { solid.translate(DVec3::Z * (-h / 2.0)) } else { solid }]))
}

const fn xy(x: f64, y: f64) -> DVec3 {
	DVec3::new(x, y, 0.0)
}

pub fn square(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		size: Vec2,
		center: bool,
	}
	let Args { size, center } = node.args()?;
	let (x0, y0) = if center { (-size.x / 2.0, -size.y / 2.0) } else { (0.0, 0.0) };
	let corners = [xy(x0, y0), xy(x0 + size.x, y0), xy(x0 + size.x, y0 + size.y), xy(x0, y0 + size.y)];
	Ok(Geometry::Profiles(vec![Edge::polygon(&corners)?]))
}

pub fn circle(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		r: f64,
	}
	let Args { r } = node.args()?;
	Ok(Geometry::Profiles(vec![vec![Edge::circle(r, DVec3::Z)?]]))
}

/// `paths` (indices into `points`) make one profile of several loops: the first is the outline,
/// the others are holes. Without `paths`, all points form a single loop.
pub fn polygon(node: &Node, _: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	struct Args {
		points: Vec<Vec2>,
		paths: Option<Vec<Vec<usize>>>,
	}
	let Args { points, paths } = node.args()?;
	let points: Vec<DVec3> = points.iter().map(|p| xy(p.x, p.y)).collect();
	let Some(paths) = paths else {
		return Ok(Geometry::Profiles(vec![Edge::polygon(&points)?]));
	};
	let mut profile = Vec::new();
	for path in paths {
		let loop_points = path.iter().map(|&i| points.get(i).copied().ok_or_else(|| KernelError::new(format!("path index {i} is out of range ({} points)", points.len())))).collect::<Result<Vec<_>>>()?;
		profile.extend(Edge::polygon(&loop_points)?);
	}
	Ok(Geometry::Profiles(vec![profile]))
}
