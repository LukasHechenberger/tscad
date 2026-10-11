//! Kernel extension: OpenSCAD-style 2D offset, implemented in C++ on OCCT's
//! `BRepOffsetAPI_MakeOffset`. Results are exact (lines and circular arcs, not polylines).
//!
//! This is the template for kernel extensions: a crate with its own cxx bridge that aliases
//! cadrum's OCCT types (via the patched cadrum, see vendor/README.md), exposing plain Rust
//! functions on cadrum values. The kernel wraps it as an operation behind a Cargo feature.

use cadrum::Edge;

#[cxx::bridge]
mod ffi {
	#[namespace = "cadrum"]
	unsafe extern "C++" {
		include!("tscad-ext-offset/src/offset.h");
		type TopoDS_Edge = cadrum::occt::ffi::TopoDS_Edge;
	}

	#[namespace = "tscad"]
	unsafe extern "C++" {
		include!("tscad-ext-offset/src/offset.h");
		type EdgeList;
		type OffsetResult;

		fn edge_list_new() -> UniquePtr<EdgeList>;
		fn edge_list_push(list: Pin<&mut EdgeList>, edge: &TopoDS_Edge);
		fn offset_profile(list: &EdgeList, distance: f64, round: bool) -> Result<UniquePtr<OffsetResult>>;
		fn offset_loop_count(result: &OffsetResult) -> usize;
		fn offset_loop_len(result: &OffsetResult, loop_index: usize) -> usize;
		fn offset_edge(result: &OffsetResult, loop_index: usize, index: usize) -> UniquePtr<TopoDS_Edge>;
	}
}

/// How corners are joined when offsetting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Join {
	/// Circular arcs (OpenSCAD `offset(r = …)`).
	Round,
	/// Sides extended until they meet (OpenSCAD `offset(delta = …)`).
	Sharp,
}

/// Offsets one closed planar profile by `distance` (positive grows it). Returns the resulting
/// closed loops: none if a negative offset consumes the profile, several if it splits.
pub fn offset(profile: &[Edge], distance: f64, join: Join) -> Result<Vec<Vec<Edge>>, String> {
	let mut list = ffi::edge_list_new();
	for edge in profile {
		ffi::edge_list_push(list.pin_mut(), edge.as_occt());
	}
	let result = ffi::offset_profile(&list, distance, join == Join::Round).map_err(|e| e.what().to_string())?;
	Ok((0..ffi::offset_loop_count(&result)).map(|l| (0..ffi::offset_loop_len(&result, l)).map(|i| Edge::from_occt(ffi::offset_edge(&result, l, i))).collect()).collect())
}

#[cfg(test)]
mod tests {
	use cadrum::{DVec3, Solid};

	use super::*;

	fn square(size: f64) -> Vec<Edge> {
		let p = |x: f64, y: f64| DVec3::new(x, y, 0.0);
		Edge::polygon(&[p(0.0, 0.0), p(size, 0.0), p(size, size), p(0.0, size)]).unwrap()
	}

	fn area(loops: &[Vec<Edge>]) -> f64 {
		// Extruding by 1 makes the volume equal the enclosed area.
		loops.iter().map(|l| Solid::extrude(l, DVec3::Z).unwrap().volume()).sum()
	}

	#[test]
	fn round_offset_adds_quarter_circles() {
		let loops = offset(&square(10.0), 2.0, Join::Round).unwrap();
		assert_eq!(loops.len(), 1);
		assert_eq!(loops[0].len(), 8, "4 sides + 4 corner arcs");
		// 10×10 + 4 sides × (10×2) + a full circle of radius 2 from the corners
		let expected = 100.0 + 80.0 + std::f64::consts::PI * 4.0;
		assert!((area(&loops) - expected).abs() < 1e-6, "{}", area(&loops));
	}

	#[test]
	fn sharp_offset_keeps_corners() {
		let loops = offset(&square(10.0), 2.0, Join::Sharp).unwrap();
		assert_eq!(loops[0].len(), 4);
		assert!((area(&loops) - 196.0).abs() < 1e-6);
	}

	#[test]
	fn negative_offset_shrinks_and_can_vanish() {
		assert!((area(&offset(&square(10.0), -2.0, Join::Round).unwrap()) - 36.0).abs() < 1e-6);
		assert!(offset(&square(10.0), -6.0, Join::Round).map(|l| l.is_empty()).unwrap_or(true));
	}

	#[test]
	fn circles_stay_circles() {
		let loops = offset(&[Edge::circle(5.0, DVec3::Z).unwrap()], 1.0, Join::Round).unwrap();
		assert_eq!(loops[0].len(), 1);
		assert!((area(&loops) - std::f64::consts::PI * 36.0).abs() < 1e-6);
	}
}
