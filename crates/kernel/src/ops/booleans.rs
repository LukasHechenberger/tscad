use cadrum::{Boolean, Solid};

use crate::booleans_util::{as_boolean, clean, union_solids};
use crate::error::Result;
use crate::geometry::Geometry;
use crate::kernel::Evaluator;
use crate::node::Node;

pub fn union(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	Ok(Geometry::Solids(union_solids(eval.solids(&node.children)?)?))
}

/// Subtracts every later child from the first, like OpenSCAD.
pub fn difference(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	let Some((first, rest)) = node.children.split_first() else { return Ok(Geometry::Solids(Vec::new())) };
	let base = eval.solids(std::slice::from_ref(first))?;
	let cut = eval.solids(rest)?;
	Ok(Geometry::Solids(match (as_boolean(&base), as_boolean(&cut)) {
		(Some(base), Some(cut)) => clean((base - cut).build_vec()?)?,
		_ => base,
	}))
}

pub fn intersection(node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
	let mut acc: Option<Boolean<Solid>> = None;
	for child in &node.children {
		let Some(b) = as_boolean(&eval.solids(std::slice::from_ref(child))?) else { return Ok(Geometry::Solids(Vec::new())) };
		acc = Some(match acc {
			Some(a) => a * b,
			None => b,
		});
	}
	Ok(Geometry::Solids(match acc {
		Some(b) => clean(b.build_vec()?)?,
		None => Vec::new(),
	}))
}
