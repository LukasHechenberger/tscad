//! Turning evaluated geometry into files, raw mesh arrays, or summary info.

use std::collections::HashMap;

use cadrum::{Mesh, SceneOption, Solid, Tessellation};
use serde_json::json;

use crate::error::{KernelError, Result};
use crate::geometry::Geometry;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Format {
	Stl,
	Step,
	Glb,
	/// cadrum's fixed 1024×1024 preview: isometric, top, front and right views.
	Png,
	/// A single isometric line drawing (hidden edges dashed), e.g. for documentation.
	Svg,
}

impl Format {
	pub fn from_code(code: u32) -> Result<Self> {
		Ok(match code {
			0 => Format::Stl,
			1 => Format::Step,
			2 => Format::Glb,
			3 => Format::Png,
			4 => Format::Svg,
			_ => return Err(KernelError::new(format!("unknown format code {code}"))),
		})
	}
}

fn solids(geometry: &Geometry) -> Result<&[Solid]> {
	match geometry {
		Geometry::Solids(solids) if solids.is_empty() => Err(KernelError::new("model is empty")),
		Geometry::Solids(solids) => Ok(solids),
		Geometry::Profiles(_) => Err(KernelError::new("cannot export a 2D shape; wrap it in linear_extrude")),
	}
}

/// Writes the geometry in `format`.
pub fn export(geometry: &Geometry, format: Format) -> Result<Vec<u8>> {
	let solids = solids(geometry)?;
	let mut out = Vec::new();
	match format {
		Format::Step => Solid::write_step(solids, &mut out)?,
		Format::Stl => Solid::mesh(solids, Default::default())?.write_stl(&mut out)?,
		Format::Glb => Solid::mesh(solids, Default::default())?.write_gltf_binary(&mut out)?,
		Format::Png => preview_mesh(solids)?.write_multiview_png(&mut out)?,
		Format::Svg => preview_mesh(solids)?.scene(SceneOption { shading: true, ..Default::default() }).write_svg(&mut out)?,
	}
	Ok(out)
}

/// A mesh fine enough for crisp outlines in the PNG preview: chord deviation at most 0.1% of
/// the model's diagonal (what `Solid::write_multiview_png` uses for a single solid).
fn preview_mesh(solids: &[Solid]) -> Result<Mesh> {
	let [min, max] = bounding_box(solids);
	let diagonal = (max - min).length();
	let tolerance = if diagonal > 0.0 { diagonal * 0.001 } else { 0.001 };
	Ok(Solid::mesh(solids, Tessellation { deflection_linear: tolerance, relative_linear: false, ..Default::default() })?)
}

fn bounding_box(solids: &[Solid]) -> [cadrum::DVec3; 2] {
	solids.iter().map(Solid::bounding_box).reduce(|[a0, a1], [b0, b1]| [a0.min(b0), a1.max(b1)]).unwrap_or_default()
}

/// The mesh as flat little-endian arrays, for consumers that render or process it themselves
/// (viewers, plugins). Layout, every section 4-byte aligned:
///
/// ```text
/// u32 vertexCount V, triangleCount T, faceCount F, edgePointCount E
/// f32 positions[3V]   f32 normals[3V]   u32 indices[3T]
/// u32 triangleFaces[T]   (dense face index 0..F per triangle)
/// f32 faceColors[3F]     (RGB 0..1; NaN where a face has no color)
/// f32 edges[3E]          (B-rep edges as polylines, separated by a NaN point)
/// ```
pub fn mesh_data(geometry: &Geometry) -> Result<Vec<u8>> {
	let mesh = Solid::mesh(solids(geometry)?, Default::default())?;

	let mut faces: HashMap<u64, u32> = HashMap::new();
	let mut face_order: Vec<u64> = Vec::new();
	let triangle_faces: Vec<u32> = mesh
		.face_ids
		.iter()
		.map(|id| {
			*faces.entry(*id).or_insert_with(|| {
				face_order.push(*id);
				(face_order.len() - 1) as u32
			})
		})
		.collect();

	let mut out = Vec::new();
	let u32s = |values: &mut dyn Iterator<Item = u32>, out: &mut Vec<u8>| values.for_each(|v| out.extend_from_slice(&v.to_le_bytes()));
	let f32s = |values: &mut dyn Iterator<Item = f32>, out: &mut Vec<u8>| values.for_each(|v| out.extend_from_slice(&v.to_le_bytes()));
	let xyz = |v: &cadrum::DVec3| [v.x as f32, v.y as f32, v.z as f32];

	u32s(&mut [mesh.vertices.len(), mesh.indices.len() / 3, face_order.len(), mesh.edges.len()].into_iter().map(|n| n as u32), &mut out);
	f32s(&mut mesh.vertices.iter().flat_map(xyz), &mut out);
	f32s(&mut mesh.normals.iter().flat_map(xyz), &mut out);
	u32s(&mut mesh.indices.iter().map(|&i| i as u32), &mut out);
	u32s(&mut triangle_faces.into_iter(), &mut out);
	f32s(&mut face_order.iter().flat_map(|id| mesh.colormap.get(id).map_or([f32::NAN; 3], |c| [c.r, c.g, c.b])), &mut out);
	f32s(&mut mesh.edges.iter().flat_map(xyz), &mut out);
	Ok(out)
}

/// Summary of the geometry as JSON: kind, piece count, and for solids volume, area, bounding box.
pub fn info(geometry: &Geometry) -> Vec<u8> {
	let value = match geometry {
		Geometry::Profiles(profiles) => json!({ "kind": "profiles", "count": profiles.len() }),
		Geometry::Solids(solids) => {
			let [min, max] = bounding_box(solids);
			json!({
				"kind": "solids",
				"count": solids.len(),
				"volume": solids.iter().map(Solid::volume).sum::<f64>(),
				"area": solids.iter().map(Solid::area).sum::<f64>(),
				"boundingBox": { "min": [min.x, min.y, min.z], "max": [max.x, max.y, max.z] },
			})
		}
	};
	serde_json::to_vec(&value).expect("JSON values serialize")
}
