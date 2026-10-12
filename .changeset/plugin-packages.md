---
'@tscad/modeling': minor
'@tscad/cli': minor
'@tscad/plugin-sdk': minor
'@tscad/plugin-grid': minor
'@tscad/plugin-export-3mf': minor
'@tscad/plugin-printability': minor
---

Plugins are npm packages now. Install one (`bun add @tscad/plugin-grid`) and the CLI and the preview load it from the model's dependencies, found by a `"tscad": { "plugin": "./dist" }` field in its package.json; `tscad.json` remains for local plugins. Operation plugins export typed functions (`grid(options, ...children)`, built with the new `pluginOperation` from `@tscad/modeling`), documented in the API reference.

`@tscad/plugin-sdk` is for writing plugins: it ships the WIT plugins implement and `tscad-plugin build`, which compiles a plugin's Rust crate into a WebAssembly component and generates its typed exports from the plugin's options.
