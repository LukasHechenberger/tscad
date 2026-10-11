use std::fmt;

/// An evaluation or export failure, as a message for the user.
#[derive(Debug, Clone, PartialEq)]
pub struct KernelError(pub String);

impl KernelError {
	pub fn new(message: impl Into<String>) -> Self {
		Self(message.into())
	}

	/// Prefixes the message with the operation it happened in (`difference: …`).
	pub fn context(self, op: &str) -> Self {
		Self(format!("{op}: {}", self.0))
	}
}

impl fmt::Display for KernelError {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		f.write_str(&self.0)
	}
}

impl std::error::Error for KernelError {}

impl From<cadrum::Error> for KernelError {
	fn from(error: cadrum::Error) -> Self {
		Self(format!("{error:?}"))
	}
}

impl From<serde_json::Error> for KernelError {
	fn from(error: serde_json::Error) -> Self {
		Self(error.to_string())
	}
}

pub type Result<T, E = KernelError> = std::result::Result<T, E>;
