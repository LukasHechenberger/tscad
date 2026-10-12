//! Exporter plugin: 3MF, the 3D-printing interchange format (a zip with an XML mesh). Merges the
//! kernel's per-face vertices into a shared, watertight vertex list, as slicers expect, and keeps
//! face colors as base materials.

use std::collections::HashMap;
use std::fmt::Write;

wit_bindgen::generate!({ world: "exporter", path: "node_modules/@tscad/plugin-sdk/wit" });

struct Export3mf;

impl Guest for Export3mf {
	fn info() -> PluginInfo {
		PluginInfo {
			name: "export-3mf".into(),
			version: env!("CARGO_PKG_VERSION").into(),
			description: "3MF, the 3D-printing format: a watertight mesh in millimeters, face colors as materials.".into(),
			options_schema: String::new(),
		}
	}

	fn file_extension() -> String {
		"3mf".into()
	}

	fn write(mesh: Mesh, _options: String) -> Result<Vec<u8>, String> {
		let model = model_xml(&mesh)?;
		Ok(zip_stored(&[("[Content_Types].xml", CONTENT_TYPES.as_bytes()), ("_rels/.rels", RELS.as_bytes()), ("3D/3dmodel.model", model.as_bytes())]))
	}
}

export!(Export3mf);

const CONTENT_TYPES: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>"#;

const RELS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>"#;

fn model_xml(mesh: &Mesh) -> Result<String, String> {
	if mesh.positions.len() % 3 != 0 || mesh.indices.len() % 3 != 0 {
		return Err("3mf: malformed mesh".into());
	}
	// Shared vertices: the kernel duplicates them per B-rep face (for sharp normals).
	let mut merged: HashMap<[u32; 3], u32> = HashMap::new();
	let mut vertices = String::new();
	let remap: Vec<u32> = mesh
		.positions
		.chunks_exact(3)
		.map(|p| {
			let key = [p[0].to_bits(), p[1].to_bits(), p[2].to_bits()];
			let next = merged.len() as u32;
			*merged.entry(key).or_insert_with(|| {
				let _ = write!(vertices, r#"<vertex x="{}" y="{}" z="{}"/>"#, p[0], p[1], p[2]);
				next
			})
		})
		.collect();

	// One base material per distinct face color.
	let mut colors: Vec<[u8; 3]> = Vec::new();
	let face_material: Vec<Option<usize>> = mesh
		.face_colors
		.chunks_exact(3)
		.map(|c| {
			if c[0].is_nan() {
				return None;
			}
			let rgb = [c[0], c[1], c[2]].map(|v| (v.clamp(0.0, 1.0) * 255.0).round() as u8);
			Some(colors.iter().position(|&known| known == rgb).unwrap_or_else(|| {
				colors.push(rgb);
				colors.len() - 1
			}))
		})
		.collect();

	let mut triangles = String::new();
	for (t, tri) in mesh.indices.chunks_exact(3).enumerate() {
		let [v1, v2, v3] = [tri[0], tri[1], tri[2]].map(|i| remap[i as usize]);
		if v1 == v2 || v2 == v3 || v1 == v3 {
			continue; // degenerate after merging
		}
		let material = mesh.triangle_faces.get(t).and_then(|&f| face_material.get(f as usize).copied().flatten());
		match material {
			Some(m) => write!(triangles, r#"<triangle v1="{v1}" v2="{v2}" v3="{v3}" pid="1" p1="{m}"/>"#),
			None => write!(triangles, r#"<triangle v1="{v1}" v2="{v2}" v3="{v3}"/>"#),
		}
		.unwrap();
	}

	let mut resources = String::new();
	if !colors.is_empty() {
		resources.push_str(r#"<basematerials id="1">"#);
		for [r, g, b] in &colors {
			write!(resources, r##"<base name="#{r:02X}{g:02X}{b:02X}" displaycolor="#{r:02X}{g:02X}{b:02X}"/>"##).unwrap();
		}
		resources.push_str("</basematerials>");
	}
	Ok(format!(
		r#"<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources>{resources}<object id="2" type="model"><mesh><vertices>{vertices}</vertices><triangles>{triangles}</triangles></mesh></object></resources><build><item objectid="2"/></build></model>"#
	))
}

/// A zip archive without compression ("stored" entries).
fn zip_stored(files: &[(&str, &[u8])]) -> Vec<u8> {
	let mut out = Vec::new();
	let mut central = Vec::new();
	for (name, data) in files {
		let offset = out.len() as u32;
		let crc = crc32fast::hash(data);
		let size = data.len() as u32;
		let header = |signature: u32, central_entry: bool| {
			let mut h = Vec::new();
			h.extend_from_slice(&signature.to_le_bytes());
			if central_entry {
				h.extend_from_slice(&20u16.to_le_bytes()); // version made by
			}
			for v in [20u16, 0, 0, 0, 0x21] {
				h.extend_from_slice(&v.to_le_bytes()); // version needed, flags, method (stored), time, date
			}
			for v in [crc, size, size] {
				h.extend_from_slice(&v.to_le_bytes());
			}
			h.extend_from_slice(&(name.len() as u16).to_le_bytes());
			h.extend_from_slice(&0u16.to_le_bytes()); // extra length
			if central_entry {
				for v in [0u16, 0, 0, 0, 0] {
					h.extend_from_slice(&v.to_le_bytes()); // comment, disk, internal attrs, external attrs (2×u16)
				}
				h.extend_from_slice(&offset.to_le_bytes());
			}
			h.extend_from_slice(name.as_bytes());
			h
		};
		out.extend(header(0x0403_4b50, false));
		out.extend_from_slice(data);
		central.extend(header(0x0201_4b50, true));
	}
	let central_offset = out.len() as u32;
	out.extend_from_slice(&central);
	out.extend_from_slice(&0x0605_4b50u32.to_le_bytes());
	for v in [0u16, 0, files.len() as u16, files.len() as u16] {
		out.extend_from_slice(&v.to_le_bytes());
	}
	out.extend_from_slice(&(central.len() as u32).to_le_bytes());
	out.extend_from_slice(&central_offset.to_le_bytes());
	out.extend_from_slice(&0u16.to_le_bytes());
	out
}
