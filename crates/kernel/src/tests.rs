use cadrum::{DVec3, Solid};

use super::*;

const EXAMPLE: &str = r#"{"type":"difference","children":[
	{"type":"cube","size":{"x":40,"y":30,"z":20},"center":true},
	{"type":"cylinder","h":30,"r1":5,"r2":5,"center":true},
	{"type":"translate","v":{"x":20,"y":15,"z":10},"children":[{"type":"sphere","r":8}]}
]}"#;

fn evaluate(json: &str) -> Result<Geometry> {
	Kernel::new().evaluate(&Node::parse(json.as_bytes())?)
}

fn solids(geometry: Geometry) -> Vec<Solid> {
	match geometry {
		Geometry::Solids(solids) => solids,
		Geometry::Profiles(_) => panic!("expected solids"),
	}
}

#[test]
fn difference_volume() {
	let solids = solids(evaluate(EXAMPLE).unwrap());
	assert_eq!(solids.len(), 1);
	// block - through-hole - one octant of the sphere
	let expected = 40.0 * 30.0 * 20.0 - std::f64::consts::PI * 25.0 * 20.0 - 4.0 / 3.0 * std::f64::consts::PI * 512.0 / 8.0;
	assert!((solids[0].volume() - expected).abs() < 1e-3, "volume {}", solids[0].volume());
}

#[test]
fn renders_every_format() {
	for format in [Format::Stl, Format::Step, Format::Glb, Format::Png, Format::Svg] {
		assert!(!render(EXAMPLE.as_bytes(), format).unwrap().is_empty());
	}
	assert!(render(EXAMPLE.as_bytes(), Format::Png).unwrap().starts_with(b"\x89PNG"));
	assert!(render(EXAMPLE.as_bytes(), Format::Svg).unwrap().starts_with(b"<svg"));
}

#[test]
fn extrudes_rotates_and_colors() {
	// A 10x10 triangle extruded by 4, rotated upright: volume 200, spanning y in [-4, 0].
	let json = r##"{"type":"color","color":"#ff0000","children":[{"type":"rotate","a":{"x":90,"y":0,"z":0},"children":[
		{"type":"linear_extrude","height":4,"center":false,"children":[{"type":"polygon","points":[{"x":0,"y":0},{"x":10,"y":0},{"x":0,"y":10}]}]}
	]}]}"##;
	let solids = solids(evaluate(json).unwrap());
	assert!((solids[0].volume() - 200.0).abs() < 1e-6);
	let [min, max] = solids[0].bounding_box();
	assert!((min.y + 4.0).abs() < 1e-6 && max.y.abs() < 1e-6 && (max.z - 10.0).abs() < 1e-6, "{min} {max}");
}

#[test]
fn transforms_apply_to_2d_profiles() {
	let json = r#"{"type":"linear_extrude","height":1,"center":false,"children":[
		{"type":"translate","v":{"x":5,"y":0,"z":0},"children":[{"type":"square","size":{"x":2,"y":2},"center":false}]}
	]}"#;
	let [min, _] = solids(evaluate(json).unwrap())[0].bounding_box();
	assert!((min.x - 5.0).abs() < 1e-6, "{min}"); // OCCT pads boxes by its tolerance (1e-7)
}

#[test]
fn reports_errors_with_the_operation() {
	let error = |json: &str| evaluate(json).err().unwrap().0;
	assert!(error(r#"{"type":"union","children":[{"type":"circle","r":1}]}"#).contains("2D shape"));
	assert_eq!(error(r#"{"type":"color","color":"nope","children":[{"type":"sphere","r":1}]}"#), "color: Validation(\"nope\")");
	assert!(error(r#"{"type":"nope"}"#).contains("unknown operation \"nope\""));
	assert!(error(r#"{"type":"plugin","plugin":"grid","args":{}}"#).contains("plugin \"grid\" was not expanded; is it listed in tscad.json?"));
	assert!(error(r#"{"type":"cube","size":1}"#).starts_with("cube: invalid arguments"));
	assert!(Node::parse(b"[]").unwrap_err().0.contains("invalid tree"));
	assert!(export(&evaluate(r#"{"type":"circle","r":1}"#).unwrap(), Format::Stl).unwrap_err().0.contains("2D shape"));
}

#[test]
fn equal_subtrees_share_a_cache_key() {
	// Same subtree, different key order and position in the tree.
	let a = Node::parse(br#"{"type":"cube","size":{"x":1,"y":2,"z":3},"center":true}"#).unwrap();
	let b = Node::parse(br#"{"center":true,"size":{"z":3,"y":2,"x":1},"type":"cube"}"#).unwrap();
	assert_eq!(a.key, b.key);
	let c = Node::parse(br#"{"type":"cube","size":{"x":1,"y":2,"z":3},"center":false}"#).unwrap();
	assert_ne!(a.key, c.key);
}

#[test]
fn cache_reuses_subtrees_across_evaluations() {
	let mut kernel = Kernel::new();
	let tree = |x: f64| Node::parse(format!(r#"{{"type":"translate","v":{{"x":{x},"y":0,"z":0}},"children":[{EXAMPLE}]}}"#).as_bytes()).unwrap();

	kernel.evaluate(&tree(0.0)).unwrap();
	let first = kernel.stats();
	assert_eq!((first.hits, first.misses), (0, 1)); // the difference; translate/primitives aren't cached

	// Only the (uncached) translate changed: the difference comes from the cache.
	kernel.evaluate(&tree(5.0)).unwrap();
	assert_eq!(kernel.stats().hits, 1);
	assert_eq!(kernel.stats().misses, 1);
}

#[test]
fn cache_evicts_entries_unused_for_a_few_evaluations() {
	let mut kernel = Kernel::new();
	let union = |r: f64| Node::parse(format!(r#"{{"type":"union","children":[{{"type":"sphere","r":{r}}}]}}"#).as_bytes()).unwrap();
	for r in 1..=5 {
		kernel.evaluate(&union(r as f64)).unwrap();
	}
	assert_eq!(kernel.stats().entries, 3); // the last three generations
}

#[test]
fn extensions_register_operations() {
	struct Doubled;
	impl Operation for Doubled {
		fn evaluate(&self, node: &Node, eval: &mut Evaluator) -> Result<Geometry> {
			let solids = eval.solids(&node.children)?;
			Ok(Geometry::Solids(solids.into_iter().map(|s| s.scale(DVec3::ZERO, 2.0)).collect()))
		}
	}
	let mut kernel = Kernel::new();
	kernel.register("doubled", Doubled);
	let geometry = kernel.evaluate(&Node::parse(br#"{"type":"doubled","children":[{"type":"cube","size":{"x":1,"y":1,"z":1},"center":false}]}"#).unwrap()).unwrap();
	assert!((solids(geometry)[0].volume() - 8.0).abs() < 1e-9);
}

#[test]
fn mesh_data_layout() {
	let geometry = evaluate(r##"{"type":"color","color":"#ff0000","children":[{"type":"cube","size":{"x":1,"y":1,"z":1},"center":false}]}"##).unwrap();
	let bytes = mesh_data(&geometry).unwrap();
	let u32_at = |i: usize| u32::from_le_bytes(bytes[i * 4..i * 4 + 4].try_into().unwrap());
	let f32_at = |i: usize| f32::from_le_bytes(bytes[i * 4..i * 4 + 4].try_into().unwrap());
	let (v, t, f, e) = (u32_at(0) as usize, u32_at(1) as usize, u32_at(2) as usize, u32_at(3) as usize);
	assert_eq!((t, f), (12, 6)); // a cube: 6 faces, 2 triangles each
	assert_eq!(bytes.len(), 4 * (4 + 6 * v + 3 * t + t + 3 * f + 3 * e));
	let colors = 4 + 6 * v + 4 * t;
	assert_eq!([f32_at(colors), f32_at(colors + 1), f32_at(colors + 2)], [1.0, 0.0, 0.0]);
}

#[test]
fn info_summarizes_solids() {
	let info: serde_json::Value = serde_json::from_slice(&info(&evaluate(EXAMPLE).unwrap())).unwrap();
	assert_eq!(info["kind"], "solids");
	assert_eq!(info["count"], 1);
	let max: Vec<f64> = serde_json::from_value(info["boundingBox"]["max"].clone()).unwrap();
	assert!(max.iter().zip([20.0, 15.0, 10.0]).all(|(a, b)| (a - b).abs() < 1e-6), "{max:?}");
}

#[cfg(feature = "offset")]
#[test]
fn offset_rounds_and_extrudes() {
	let json = r#"{"type":"linear_extrude","height":1,"center":false,"children":[
		{"type":"offset","r":2,"children":[{"type":"square","size":{"x":10,"y":10},"center":true}]}
	]}"#;
	let volume = solids(evaluate(json).unwrap())[0].volume();
	assert!((volume - (180.0 + std::f64::consts::PI * 4.0)).abs() < 1e-6, "{volume}");
	let error = evaluate(r#"{"type":"offset","r":1,"delta":1,"children":[{"type":"circle","r":1}]}"#).err().unwrap().0;
	assert_eq!(error, "offset: expected exactly one of r or delta");
}

fn volume(json: &str) -> f64 {
	solids(evaluate(json).unwrap()).iter().map(Solid::volume).sum()
}

const PI: f64 = std::f64::consts::PI;

#[test]
fn mirror_and_scale() {
	let cube = r#"{"type":"cube","size":{"x":1,"y":2,"z":3},"center":false}"#;
	let mirrored = solids(evaluate(&format!(r#"{{"type":"mirror","v":{{"x":1,"y":0,"z":0}},"children":[{cube}]}}"#)).unwrap());
	let [min, max] = mirrored[0].bounding_box();
	assert!((min.x + 1.0).abs() < 1e-6 && max.x.abs() < 1e-6, "{min} {max}");
	assert!((mirrored[0].volume() - 6.0).abs() < 1e-9);
	assert!((volume(&format!(r#"{{"type":"scale","v":{{"x":2,"y":2,"z":2}},"children":[{cube}]}}"#)) - 48.0).abs() < 1e-9);
	let error = evaluate(&format!(r#"{{"type":"scale","v":{{"x":2,"y":1,"z":1}},"children":[{cube}]}}"#)).err().unwrap().0;
	assert!(error.contains("non-uniform"), "{error}");
}

#[test]
fn rotate_extrude_spins_profiles_around_z() {
	// A circle r=1 at x=5: a torus with volume 2π²·R·r².
	let torus = r#"{"type":"rotate_extrude","children":[{"type":"translate","v":{"x":5,"y":0,"z":0},"children":[{"type":"circle","r":1}]}]}"#;
	assert!((volume(torus) - 2.0 * PI * PI * 5.0).abs() < 1e-6);
	// A quarter turn of a 2x3 rectangle at x in [1, 3]: π/4·(3² − 1²)·3.
	let quarter = r#"{"type":"rotate_extrude","angle":90,"children":[{"type":"translate","v":{"x":1,"y":0,"z":0},"children":[{"type":"square","size":{"x":2,"y":3},"center":false}]}]}"#;
	let solid = &solids(evaluate(quarter).unwrap())[0];
	assert!((solid.volume() - PI / 4.0 * 8.0 * 3.0).abs() < 1e-6);
	let [min, max] = solid.bounding_box();
	assert!(min.x > -1e-6 && min.y > -1e-6 && (max.z - 3.0).abs() < 1e-6, "{min} {max}");
	let error = evaluate(r#"{"type":"rotate_extrude","children":[{"type":"circle","r":1}]}"#).err().unwrap().0;
	assert!(error.contains("crosses the Z axis"), "{error}");
}

#[test]
fn linear_extrude_scales_and_twists() {
	// Frustum of a square pyramid: h/3·(A1 + A2 + √(A1·A2)) with A1 = 4, A2 = 1.
	let taper = r#"{"type":"linear_extrude","height":3,"center":false,"scale":0.5,"children":[{"type":"square","size":{"x":2,"y":2},"center":true}]}"#;
	assert!((volume(taper) - 1.0 * (4.0 + 1.0 + 2.0)).abs() < 1e-6);
	// Twisting keeps every cross-section's area: still 2·2·3.
	let twist = r#"{"type":"linear_extrude","height":3,"center":false,"twist":90,"children":[{"type":"square","size":{"x":2,"y":2},"center":true}]}"#;
	assert!((volume(twist) - 12.0).abs() < 12.0 * 1e-3, "{}", volume(twist));
}

#[test]
fn polygon_paths_make_holes() {
	let frame = r#"{"type":"linear_extrude","height":1,"center":false,"children":[{"type":"polygon",
		"points":[{"x":0,"y":0},{"x":10,"y":0},{"x":10,"y":10},{"x":0,"y":10},{"x":2,"y":2},{"x":8,"y":2},{"x":8,"y":8},{"x":2,"y":8}],
		"paths":[[0,1,2,3],[4,5,6,7]]}]}"#;
	assert!((volume(frame) - 64.0).abs() < 1e-9);
	let error = evaluate(r#"{"type":"polygon","points":[{"x":0,"y":0},{"x":1,"y":0},{"x":0,"y":1}],"paths":[[0,1,3]]}"#).err().unwrap().0;
	assert!(error.contains("path index 3 is out of range"), "{error}");
}
