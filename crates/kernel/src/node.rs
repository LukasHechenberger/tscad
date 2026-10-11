//! The CSG tree as the kernel sees it: generic nodes, so extensions can add node types.

use std::hash::{DefaultHasher, Hash, Hasher};

use serde::de::DeserializeOwned;
use serde_json::{Map, Value};

use crate::error::{KernelError, Result};

/// `{ "type": op, ...args, "children"?: [...] }`, plus a structural hash of the whole subtree.
#[derive(Debug, Clone)]
pub struct Node {
	pub op: String,
	pub args: Map<String, Value>,
	pub children: Vec<Node>,
	/// Equal for structurally equal subtrees, however they were built. Computed bottom-up from
	/// the op, its arguments and the children's keys, so the whole tree is hashed only once.
	pub key: u64,
}

impl Node {
	pub fn parse(json: &[u8]) -> Result<Self> {
		let value: Value = serde_json::from_slice(json).map_err(|e| KernelError::new(format!("invalid tree: {e}")))?;
		Self::from_value(value)
	}

	pub fn from_value(value: Value) -> Result<Self> {
		let Value::Object(mut args) = value else { return Err(KernelError::new("invalid tree: a node must be an object")) };
		let op = match args.remove("type") {
			Some(Value::String(op)) => op,
			_ => return Err(KernelError::new("invalid tree: a node needs a string \"type\"")),
		};
		let children = match args.remove("children") {
			None => Vec::new(),
			Some(Value::Array(children)) => children.into_iter().map(Node::from_value).collect::<Result<_>>()?,
			Some(_) => return Err(KernelError::new(format!("invalid tree: \"children\" of {op} must be an array"))),
		};
		let mut hasher = DefaultHasher::new();
		op.hash(&mut hasher);
		// serde_json's Map is ordered by key, so this is canonical.
		serde_json::to_string(&args).expect("JSON values serialize").hash(&mut hasher);
		for child in &children {
			child.key.hash(&mut hasher);
		}
		Ok(Node { op, args, children, key: hasher.finish() })
	}

	/// Deserializes this node's arguments (everything but `type` and `children`) into `T`.
	pub fn args<T: DeserializeOwned>(&self) -> Result<T> {
		T::deserialize(Value::Object(self.args.clone())).map_err(|e| KernelError::new(format!("invalid arguments: {e}")))
	}
}
