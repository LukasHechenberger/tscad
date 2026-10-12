//! Operation plugin: `grid` repeats its children on an nx × ny grid, entirely through host
//! kernel calls (one `translate` per copy, one `union`).

use schemars::JsonSchema;
use serde::Deserialize;

wit_bindgen::generate!({ world: "operation", path: "../../wit" });

use tscad::plugin::kernel::union;
use tscad::plugin::types::Vec3;

/// Repeats its children on an `nx` × `ny` grid, `dx` and `dy` apart.
///
/// @example
/// ```ts
/// grid({ nx: 3, ny: 2, dx: 10, dy: 10 }, cylinder({ h: 4, r: 3 }))
/// ```
#[derive(Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
struct Options {
	/// Number of copies along X.
	#[schemars(range(min = 1))]
	nx: u32,
	/// Number of copies along Y.
	#[schemars(range(min = 1))]
	ny: u32,
	/// Distance between copies along X, in millimeters.
	dx: f64,
	/// Distance between copies along Y, in millimeters.
	dy: f64,
}

struct Grid;

impl Guest for Grid {
	fn info() -> PluginInfo {
		PluginInfo {
			name: "grid".into(),
			version: env!("CARGO_PKG_VERSION").into(),
			description: "Repeats its children on an nx × ny grid with spacing dx, dy.".into(),
			options_schema: schemars::schema_for!(Options).to_value().to_string(),
		}
	}

	fn evaluate(args: String, children: Vec<Shape>) -> Result<Shape, String> {
		let Options { nx, ny, dx, dy } = serde_json::from_str(&args).map_err(|e| format!("invalid options: {e}"))?;
		let child = match children.len() {
			0 => return Err("needs at least one child".into()),
			1 => children.into_iter().next().unwrap(),
			_ => union(&children.iter().collect::<Vec<_>>()),
		};
		let copies: Vec<Shape> = (0..nx).flat_map(|i| (0..ny).map(move |j| (i, j))).map(|(i, j)| child.translate(Vec3 { x: f64::from(i) * dx, y: f64::from(j) * dy, z: 0.0 })).collect();
		Ok(union(&copies.iter().collect::<Vec<_>>()))
	}
}

export!(Grid);
