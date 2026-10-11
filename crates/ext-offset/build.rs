//! Compiles the extension's C++ against the same OCCT headers and flags as cadrum, which exports
//! them (patched cadrum, see vendor/README.md) as DEP_CADRUM_OCCT_INCLUDE / _CXXFLAGS.

fn main() {
	let include = std::env::var("DEP_CADRUM_OCCT_INCLUDE").expect("cadrum must export its OCCT include dir (patched cadrum, see vendor/README.md)");
	let flags = std::env::var("DEP_CADRUM_OCCT_CXXFLAGS").unwrap_or_default();
	let mut build = cxx_build::bridge("src/lib.rs");
	build.file("src/offset.cpp").include(&include).std("c++17").define("_USE_MATH_DEFINES", None);
	for flag in flags.split_whitespace() {
		build.flag(flag);
	}
	build.compile("tscad-ext-offset");
	println!("cargo:rerun-if-changed=src/lib.rs");
	println!("cargo:rerun-if-changed=src/offset.h");
	println!("cargo:rerun-if-changed=src/offset.cpp");
}
