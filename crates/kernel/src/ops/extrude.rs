//! Extrusions: 2D profiles (XY plane) into solids.

use cadrum::{DVec3, Edge, Solid};
use serde::Deserialize;

use crate::booleans_util::union_solids;
use crate::error::{KernelError, Result};
use crate::geometry::{Geometry, Profile, loop_count};
use crate::kernel::Evaluator;
use crate::node::Node;

/// Extrudes each 2D child along +Z (or centered on z = 0) and unions the results. Like OpenSCAD,
/// `twist` turns the top by that many degrees clockwise and `scale` resizes it; both loft through
/// `slices` sections (straight sides for a plain taper, a smooth surface when twisted).
pub fn linear_extrude(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	#[serde(deny_unknown_fields)]
	struct Args {
		height: f64,
		center: bool,
		#[serde(default)]
		twist: f64,
		#[serde(default = "one")]
		scale: f64,
		slices: Option<usize>,
	}
	let Args { height, center, twist, scale, slices } = node.args()?;
	if !(scale > 0.0) {
		return Err(KernelError::new(format!("scale must be greater than 0, got {scale}")));
	}
	let z0 = if center { -height / 2.0 } else { 0.0 };
	let plain = twist == 0.0 && scale == 1.0;
	// One section per 10° of twist keeps the lofted surface within ~0.1% of the true helicoid.
	let slices = slices.unwrap_or_else(|| (twist.abs() / 10.0).ceil().max(1.0) as usize).max(1);

	let extrude = |profile: &Profile| -> Result<Solid> {
		if plain {
			return Ok(Solid::extrude(profile, DVec3::Z * height)?.translate(DVec3::Z * z0));
		}
		if loop_count(profile) > 1 {
			return Err(KernelError::new("twist and scale don't support shapes with holes yet"));
		}
		let sections: Vec<Vec<Edge>> = (0..=slices)
			.map(|i| {
				let t = i as f64 / slices as f64;
				let (factor, angle) = (1.0 + (scale - 1.0) * t, (-twist * t).to_radians());
				profile.iter().map(|e| e.clone().scale(DVec3::ZERO, factor).rotate_z(angle).translate(DVec3::Z * (z0 + height * t))).collect()
			})
			.collect();
		Ok(Solid::loft(&sections, twist == 0.0)?)
	};
	let solids = eval.profiles(&node.children)?.iter().map(extrude).collect::<Result<Vec<_>>>()?;
	Ok(Geometry::Solids(union_solids(solids)?))
}

const fn one() -> f64 {
	1.0
}

/// Spins each 2D child around the Z axis, like OpenSCAD: the profile's X becomes the radius and
/// its Y the height. `angle` (degrees, default 360) sweeps counterclockwise from +X.
pub fn rotate_extrude(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	#[derive(Deserialize)]
	#[serde(deny_unknown_fields)]
	struct Args {
		#[serde(default = "full_turn")]
		angle: f64,
	}
	let Args { angle } = node.args()?;
	if !(angle != 0.0 && angle.abs() <= 360.0) {
		return Err(KernelError::new(format!("angle must be within [-360, 360] and not 0, got {angle}")));
	}
	let revolve = |profile: &Profile| -> Result<Solid> {
		let (min, max) = x_range(profile);
		if min < -Edge::precision_distance() && max > Edge::precision_distance() {
			return Err(KernelError::new(format!("the profile crosses the Z axis (x from {min:.3} to {max:.3}); keep it on one side")));
		}
		// From the XY plane into XZ: y becomes z.
		let upright: Vec<Edge> = profile.iter().map(|e| e.clone().rotate_x(90f64.to_radians())).collect();
		Ok(Solid::revolve(&upright, DVec3::ZERO, DVec3::Z, angle.to_radians())?)
	};
	let solids = eval.profiles(&node.children)?.iter().map(revolve).collect::<Result<Vec<_>>>()?;
	Ok(Geometry::Solids(union_solids(solids)?))
}

const fn full_turn() -> f64 {
	360.0
}

/// The profile's extent along X, from a fine polyline approximation of its edges.
fn x_range(profile: &Profile) -> (f64, f64) {
	let tessellation = cadrum::Tessellation { deflection_linear: 1e-3, relative_linear: true, ..Default::default() };
	profile.iter().flat_map(|e| e.approximation_segments(tessellation)).fold((f64::INFINITY, f64::NEG_INFINITY), |(min, max), p| (min.min(p.x), max.max(p.x)))
}
