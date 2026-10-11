/**
 * Builds every plugin in this folder: Rust → core wasm (wasm32-unknown-unknown + wit-bindgen) →
 * component (`jco new`) → JS + core wasm in plugins/<name>/dist/plugin.js
 * (`jco transpile --instantiation async`), loadable by `@tscad/plugin-host` in Bun and browsers.
 */
/* eslint-disable no-console -- a build script reporting what it built */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { $ } from 'bun';

const root = path.join(import.meta.dir, '..');
const plugins = readdirSync(import.meta.dir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() && existsSync(path.join(import.meta.dir, entry.name, 'Cargo.toml')),
  )
  .map((entry) => entry.name);

await $`cargo build --release --target wasm32-unknown-unknown ${plugins.flatMap((p) => ['-p', `tscad-plugin-${p}`])}`
  .cwd(root)
  .env({ ...process.env, CARGO_PROFILE_RELEASE_STRIP: 'true' });
for (const plugin of plugins) {
  const core = path.join(
    root,
    'target/wasm32-unknown-unknown/release',
    `tscad_plugin_${plugin.replaceAll('-', '_')}.wasm`,
  );
  const outputDirectory = path.join(root, 'plugins', plugin, 'dist');
  mkdirSync(outputDirectory, { recursive: true }); // jco does not create it
  const component = path.join(outputDirectory, 'plugin.component.wasm');
  await $`bunx jco new ${core} -o ${component}`.quiet();
  await $`bunx jco transpile ${component} -o ${outputDirectory} --name plugin --instantiation async --no-nodejs-compat -q`;
  console.log(
    `${plugin}: ${(Bun.file(component).size / 1024).toFixed(0)} KiB component → ${outputDirectory}`,
  );
}
