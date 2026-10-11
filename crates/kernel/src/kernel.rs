//! A kernel session: the operation registry, evaluated shapes by handle, and a subtree cache
//! that lives across evaluations.

use std::collections::HashMap;

use cadrum::{Edge, Solid};

use crate::error::{KernelError, Result};
use crate::geometry::{Geometry, Profile};
use crate::node::Node;

/// Implements one node type. Built-in operations use this trait too (see `ops`), so extensions
/// are first-class: `kernel.register("text", TextOp)`.
pub trait Operation {
	/// Whether results are memoized by subtree. Worth it for anything costlier than a deep copy
	/// (booleans, extrusions); cheap primitives opt out.
	fn cached(&self) -> bool {
		true
	}

	fn evaluate(&self, node: &Node, eval: &mut Evaluator) -> Result<Geometry>;
}

impl<F: Fn(&Node, &mut Evaluator) -> Result<Geometry>> Operation for F {
	fn evaluate(&self, node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
		self(node, eval)
	}
}

/// Wraps an operation function that is not worth caching.
pub struct Uncached<F>(pub F);

impl<F: Fn(&Node, &mut Evaluator) -> Result<Geometry>> Operation for Uncached<F> {
	fn cached(&self) -> bool {
		false
	}

	fn evaluate(&self, node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
		(self.0)(node, eval)
	}
}

/// Cache entries survive this many evaluations without being used, so e.g. dragging a
/// parameter slider back and forth stays fast.
const CACHE_GENERATIONS: u64 = 3;

struct CacheEntry {
	geometry: Geometry,
	last_used: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CacheStats {
	pub hits: u64,
	pub misses: u64,
	pub entries: usize,
}

/// Identifies a shape kept in a `Kernel` until released.
pub type Handle = u32;

pub struct Kernel {
	ops: HashMap<String, Box<dyn Operation>>,
	cache: HashMap<u64, CacheEntry>,
	generation: u64,
	stats: CacheStats,
	shapes: HashMap<Handle, Geometry>,
	next_handle: Handle,
}

impl Default for Kernel {
	fn default() -> Self {
		Self::new()
	}
}

impl Kernel {
	/// A kernel with the built-in operations.
	pub fn new() -> Self {
		let mut kernel = Self::empty();
		crate::ops::register_builtins(&mut kernel);
		kernel
	}

	/// A kernel without any operations.
	pub fn empty() -> Self {
		Kernel { ops: HashMap::new(), cache: HashMap::new(), generation: 0, stats: CacheStats::default(), shapes: HashMap::new(), next_handle: 0 }
	}

	/// Adds (or replaces) the operation for nodes of type `name`.
	pub fn register(&mut self, name: impl Into<String>, op: impl Operation + 'static) {
		self.ops.insert(name.into(), Box::new(op));
	}

	/// Evaluates a tree. Subtrees already evaluated recently (in this or one of the last few
	/// evaluations) are reused instead of rebuilt.
	pub fn evaluate(&mut self, node: &Node) -> Result<Geometry> {
		self.generation += 1;
		let mut eval = Evaluator { ops: &self.ops, cache: &mut self.cache, generation: self.generation, stats: &mut self.stats };
		let result = eval.evaluate(node);
		let oldest = self.generation.saturating_sub(CACHE_GENERATIONS - 1);
		self.cache.retain(|_, entry| entry.last_used >= oldest);
		self.stats.entries = self.cache.len();
		result
	}

	pub fn stats(&self) -> CacheStats {
		self.stats
	}

	// ---- shapes by handle (for the C ABI and, later, plugins) ----

	pub fn insert(&mut self, geometry: Geometry) -> Handle {
		let handle = self.next_handle;
		self.next_handle = (self.next_handle + 1) % i32::MAX as u32; // fits the C ABI's i32
		self.shapes.insert(handle, geometry);
		handle
	}

	pub fn get(&self, handle: Handle) -> Result<&Geometry> {
		self.shapes.get(&handle).ok_or_else(|| KernelError::new(format!("no shape with handle {handle}")))
	}

	pub fn release(&mut self, handle: Handle) {
		self.shapes.remove(&handle);
	}
}

/// Evaluation state handed to operations, so they can evaluate their children.
pub struct Evaluator<'a> {
	ops: &'a HashMap<String, Box<dyn Operation>>,
	cache: &'a mut HashMap<u64, CacheEntry>,
	generation: u64,
	stats: &'a mut CacheStats,
}

impl Evaluator<'_> {
	pub fn evaluate(&mut self, node: &Node) -> Result<Geometry> {
		let op = self.ops.get(&node.op).ok_or_else(|| match (node.op.as_str(), node.args.get("plugin")) {
			// Plugin nodes are expanded by the JS host (@tscad/plugin-host) before evaluation.
			("plugin", Some(name)) => KernelError::new(format!("plugin {name} was not expanded; is it listed in tscad.json?")),
			_ => KernelError::new(format!("unknown operation \"{}\"", node.op)),
		})?;
		if !op.cached() {
			return op.evaluate(node, self).map_err(|e| e.context(&node.op));
		}
		if let Some(entry) = self.cache.get_mut(&node.key) {
			entry.last_used = self.generation;
			self.stats.hits += 1;
			return Ok(entry.geometry.clone());
		}
		self.stats.misses += 1;
		let geometry = op.evaluate(node, self).map_err(|e| e.context(&node.op))?;
		self.cache.insert(node.key, CacheEntry { geometry: geometry.clone(), last_used: self.generation });
		Ok(geometry)
	}

	/// Evaluates `nodes` as one group (an implicit union in OpenSCAD terms, without merging).
	/// All of them must be of the same kind, 2D or 3D.
	pub fn group(&mut self, nodes: &[Node]) -> Result<Geometry> {
		let mut solids: Vec<Solid> = Vec::new();
		let mut profiles: Vec<Profile> = Vec::new();
		for node in nodes {
			match self.evaluate(node)? {
				Geometry::Solids(s) => solids.extend(s),
				Geometry::Profiles(p) => profiles.extend(p),
			}
		}
		match (solids.is_empty(), profiles.is_empty()) {
			(_, true) => Ok(Geometry::Solids(solids)),
			(true, false) => Ok(Geometry::Profiles(profiles)),
			(false, false) => Err(KernelError::new("cannot mix 2D and 3D children")),
		}
	}

	pub fn solids(&mut self, nodes: &[Node]) -> Result<Vec<Solid>> {
		match self.group(nodes)? {
			Geometry::Solids(solids) => Ok(solids),
			Geometry::Profiles(_) => Err(KernelError::new("2D shape used as a solid; wrap it in linear_extrude")),
		}
	}

	pub fn profiles(&mut self, nodes: &[Node]) -> Result<Vec<Vec<Edge>>> {
		match self.group(nodes)? {
			Geometry::Profiles(profiles) => Ok(profiles),
			Geometry::Solids(solids) if solids.is_empty() => Ok(Vec::new()),
			Geometry::Solids(_) => Err(KernelError::new("expected 2D children (square, circle, polygon)")),
		}
	}
}
