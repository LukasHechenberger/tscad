//! Native debugging aid: `cargo run -p tscad-kernel --example render -- tree.json out.stl`
//! (dump a tree with `bun -e 'console.log(JSON.stringify(...))'`). Prints per-phase timings.

use std::time::Instant;

use tscad_kernel::{Format, Kernel, Node, export};

fn main() {
	let args: Vec<String> = std::env::args().collect();
	let [_, input, output] = args.as_slice() else {
		eprintln!("usage: render <tree.json> <out.stl|.step|.glb|.png|.svg>");
		std::process::exit(2);
	};
	let format = match output.rsplit('.').next() {
		Some("step") => Format::Step,
		Some("glb") => Format::Glb,
		Some("png") => Format::Png,
		Some("svg") => Format::Svg,
		_ => Format::Stl,
	};

	let t = Instant::now();
	let node = Node::parse(&std::fs::read(input).expect("read input")).unwrap_or_else(|e| fail(e.0));
	let parsed = t.elapsed();
	let geometry = Kernel::new().evaluate(&node).unwrap_or_else(|e| fail(e.0));
	let evaluated = t.elapsed();
	let bytes = export(&geometry, format).unwrap_or_else(|e| fail(e.0));
	let exported = t.elapsed();
	std::fs::write(output, &bytes).expect("write output");
	println!("wrote {output} ({} bytes): parse {:?}, evaluate {:?}, export {:?}", bytes.len(), parsed, evaluated - parsed, exported - evaluated);
}

fn fail(msg: String) -> ! {
	eprintln!("error: {msg}");
	std::process::exit(1);
}
