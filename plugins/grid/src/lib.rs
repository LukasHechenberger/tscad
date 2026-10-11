//! Operation plugin: `grid` repeats its children on an nx × ny grid, entirely through host
//! kernel calls (one `translate` per copy, one `union`).

use serde::Deserialize;

wit_bindgen::generate!({ world: "operation", path: "../../wit" });

use tscad::plugin::kernel::union;
use tscad::plugin::types::Vec3;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Args {
	nx: u32,
	ny: u32,
	dx: f64,
	dy: f64,
}

struct Grid;

impl Guest for Grid {
	fn info() -> PluginInfo {
		PluginInfo {
			name: "grid".into(),
			version: env!("CARGO_PKG_VERSION").into(),
			description: "Repeats its children on an nx × ny grid with spacing dx, dy.".into(),
			options_schema: r#"{"type":"object","properties":{"nx":{"type":"integer","minimum":1},"ny":{"type":"integer","minimum":1},"dx":{"type":"number"},"dy":{"type":"number"}},"required":["nx","ny","dx","dy"]}"#.into(),
		}
	}

	fn evaluate(args: String, children: Vec<Shape>) -> Result<Shape, String> {
		let Args { nx, ny, dx, dy } = serde_json::from_str(&args).map_err(|e| format!("invalid arguments: {e}"))?;
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
