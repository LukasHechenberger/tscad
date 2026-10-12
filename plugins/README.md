# Plugins

The plugins maintained with tscad, each its own package. Plugins are WebAssembly components written
in Rust that implement one world of [`tscad-plugin.wit`](../packages/plugin-sdk/wit/tscad-plugin.wit),
the hand-written plugin interface; each plugin's options WIT is generated from its Rust options struct.
They run sandboxed: a plugin can only call the kernel's shape API, with no file or network access.

| Package                                      | World       | What it does                                                    |
| -------------------------------------------- | ----------- | --------------------------------------------------------------- |
| [`@tscad/plugin-grid`](grid)                 | `operation` | Repeats its children on a grid: `grid({ nx, ny, dx, dy }, ...)` |
| [`@tscad/plugin-export-3mf`](export-3mf)     | `exporter`  | 3MF export with merged vertices and colors                      |
| [`@tscad/plugin-printability`](printability) | `analysis`  | Overhangs, bed contact and fit for 3D printing                  |

Each one builds with `tscad-plugin build` from [`@tscad/plugin-sdk`](../packages/plugin-sdk), like
any plugin outside this repository; `bun run build --filter='./plugins/*'` builds them all. To
write a plugin, see [Writing a plugin](https://tscad.vercel.app/docs/guides/plugins#writing-a-plugin).
