//! Boolean helpers shared by operations (and available to extensions).

use cadrum::{Boolean, Solid};

use crate::error::Result;

/// Union of several solids as one lazy boolean expression; `None` when empty.
pub fn as_boolean(solids: &[Solid]) -> Option<Boolean<Solid>> {
	solids.iter().map(Boolean::from).reduce(|a, b| a + b)
}

/// Fuses solids, merging the faces their union splits.
pub fn union_solids(solids: Vec<Solid>) -> Result<Vec<Solid>> {
	if solids.len() < 2 {
		return Ok(solids);
	}
	clean(as_boolean(&solids).unwrap().build_vec()?)
}

/// Merges faces that lie on the same surface (OCCT's UnifySameDomain). Boolean results are
/// full of split faces, e.g. where unioned pieces meet; fewer faces make every later boolean
/// and the meshing faster.
pub fn clean(solids: Vec<Solid>) -> Result<Vec<Solid>> {
	Ok(solids.iter().map(Solid::clean).collect::<Result<_, _>>()?)
}
