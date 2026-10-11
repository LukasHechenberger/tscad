//! The built-in operations, registered like any extension would be.

mod booleans;
mod extrude;
#[cfg(feature = "offset")]
mod offset;
mod primitives;
mod transforms;

use serde::Deserialize;

use crate::kernel::{Kernel, Uncached};

pub fn register_builtins(kernel: &mut Kernel) {
	// Primitives are cheaper to rebuild than to copy from the cache.
	kernel.register("cube", Uncached(primitives::cube));
	kernel.register("sphere", Uncached(primitives::sphere));
	kernel.register("cylinder", Uncached(primitives::cylinder));
	kernel.register("square", Uncached(primitives::square));
	kernel.register("circle", Uncached(primitives::circle));
	kernel.register("polygon", Uncached(primitives::polygon));
	kernel.register("linear_extrude", extrude::linear_extrude);
	kernel.register("rotate_extrude", extrude::rotate_extrude);

	kernel.register("translate", Uncached(transforms::translate));
	kernel.register("rotate", Uncached(transforms::rotate));
	kernel.register("mirror", Uncached(transforms::mirror));
	kernel.register("scale", Uncached(transforms::scale));
	kernel.register("color", Uncached(transforms::color));

	// Kernel extensions, compiled in by Cargo feature.
	#[cfg(feature = "offset")]
	kernel.register("offset", offset::offset);

	kernel.register("union", booleans::union);
	kernel.register("difference", booleans::difference);
	kernel.register("intersection", booleans::intersection);
}

#[derive(Deserialize, Clone, Copy)]
pub struct Vec2 {
	pub x: f64,
	pub y: f64,
}

#[derive(Deserialize, Clone, Copy)]
pub struct Vec3 {
	pub x: f64,
	pub y: f64,
	pub z: f64,
}

impl From<Vec3> for cadrum::DVec3 {
	fn from(v: Vec3) -> Self {
		cadrum::DVec3::new(v.x, v.y, v.z)
	}
}
