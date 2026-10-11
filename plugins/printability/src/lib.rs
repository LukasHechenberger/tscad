//! Analysis plugin: FDM printability. Reports overhanging area (downward faces steeper than the
//! overhang angle, not resting on the bed), bed contact area, and whether the model fits the bed.

use serde::{Deserialize, Serialize};
use serde_json::json;

wit_bindgen::generate!({ world: "analysis", path: "../../wit" });

use tscad::plugin::types::Mesh;

#[derive(Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
struct Options {
	/// Maximum printable overhang, in degrees from vertical (45° is the usual rule of thumb).
	overhang_angle: f64,
	/// Build volume in millimeters.
	bed: [f64; 3],
}

impl Default for Options {
	fn default() -> Self {
		Options { overhang_angle: 45.0, bed: [256.0, 256.0, 256.0] }
	}
}

#[derive(Serialize, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct Surfaces {
	total_area: f64,
	overhang_area: f64,
	bed_contact_area: f64,
}

/// Classifies every triangle by its geometric normal (from its vertices).
fn surfaces(mesh: &Mesh, overhang_angle: f64, bed_z: f64, tolerance: f64) -> Surfaces {
	let p = |i: u32| {
		let i = i as usize * 3;
		[mesh.positions[i] as f64, mesh.positions[i + 1] as f64, mesh.positions[i + 2] as f64]
	};
	// A downward face needs support if its normal is within (90° - angle) of straight down.
	let threshold = -overhang_angle.to_radians().sin();
	let mut result = Surfaces::default();
	for tri in mesh.indices.chunks_exact(3) {
		let [a, b, c] = [p(tri[0]), p(tri[1]), p(tri[2])];
		let (u, v) = ([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
		let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
		let twice_area = (n[0] * n[0] + n[1] * n[1] + n[2] * n[2]).sqrt();
		if twice_area == 0.0 {
			continue;
		}
		let area = twice_area / 2.0;
		result.total_area += area;
		let on_bed = [a, b, c].iter().all(|p| (p[2] - bed_z).abs() <= tolerance);
		if on_bed {
			result.bed_contact_area += area;
		} else if n[2] / twice_area < threshold {
			result.overhang_area += area;
		}
	}
	result
}

struct Printability;

impl Guest for Printability {
	fn info() -> PluginInfo {
		PluginInfo {
			name: "printability".into(),
			version: env!("CARGO_PKG_VERSION").into(),
			description: "FDM printability: overhangs needing support, bed contact, fit in the build volume.".into(),
			options_schema: r#"{"type":"object","properties":{"overhangAngle":{"type":"number","minimum":0,"maximum":90,"default":45,"description":"Maximum overhang in degrees from vertical"},"bed":{"type":"array","items":{"type":"number"},"minItems":3,"maxItems":3,"default":[256,256,256],"description":"Build volume in mm"}}}"#.into(),
		}
	}

	fn analyze(model: &Shape, options: String) -> Result<String, String> {
		let options: Options = if options.trim().is_empty() { Options::default() } else { serde_json::from_str(&options).map_err(|e| format!("invalid options: {e}"))? };
		let bounds = model.bounds()?;
		let size = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z];
		let mesh = model.mesh()?;
		let tolerance = 1e-6 * size.iter().cloned().fold(1.0, f64::max);
		let surfaces = surfaces(&mesh, options.overhang_angle, bounds.min.z, tolerance);

		let fits_bed = size.iter().zip(options.bed).all(|(s, b)| *s <= b);
		let mut warnings = Vec::new();
		if !fits_bed {
			warnings.push(format!("{:.1} × {:.1} × {:.1} mm does not fit the {} × {} × {} mm build volume", size[0], size[1], size[2], options.bed[0], options.bed[1], options.bed[2]));
		}
		if surfaces.overhang_area > 0.0 {
			warnings.push(format!("{:.1} mm² overhang more than {}° and need support", surfaces.overhang_area, options.overhang_angle));
		}
		if surfaces.bed_contact_area == 0.0 {
			warnings.push("nothing rests flat on the bed".into());
		}
		Ok(json!({
			"volume": model.volume()?,
			"size": size,
			"triangles": mesh.indices.len() / 3,
			"fitsBed": fits_bed,
			"totalArea": surfaces.total_area,
			"overhangArea": surfaces.overhang_area,
			"bedContactArea": surfaces.bed_contact_area,
			"needsSupport": surfaces.overhang_area > 0.0,
			"warnings": warnings,
		})
		.to_string())
	}
}

export!(Printability);
