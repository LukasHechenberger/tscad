/**
 * Builds the given targets (default: all) into this package:
 *
 * - `js`: the TypeScript entries for browsers (out/index.js), Node (out/node.js) and Bun
 *   (out/bun.js), bundled with Bun.build, and their declarations (out/types, by tsc).
 * - `native`: crates/kernel as a shared library for this machine (native/libtscad_kernel.dylib, .so or
 *   tscad_kernel.dll), loaded by Bun via bun:ffi. Plain `cargo build`.
 * - `wasm`: crates/kernel as kernel.wasm for the browser (and Bun as a fallback). Built inside cadrum's
 *   cross-compile image, the only place with the legacy-EH wasi-sdk sysroot OCCT was
 *   prebuilt against. The image is linux/amd64 only; on Apple silicon it runs emulated.
 */
/* eslint-disable no-console -- a build script reporting what it wrote */

import path from 'node:path';
import { $ } from 'bun';
import { nativeLibraryPath } from '../src/bun';

const root = path.join(import.meta.dir, '../../..');
const targets = Bun.argv.slice(2);
const megabytes = async (path: string) => `${((await Bun.file(path).size) / 1e6).toFixed(1)} MB`;

const outdir = path.join(import.meta.dir, '../out');

if (targets.length === 0 || targets.includes('js')) {
  // One bundle per runtime; kernel.wasm stays a separate file next to the package, found via
  // `new URL('../kernel.wasm', import.meta.url)` from out/.
  for (const [entry, target] of [
    ['index', 'browser'],
    ['node', 'node'],
    ['bun', 'bun'],
  ] as const) {
    const result = await Bun.build({
      entrypoints: [path.join(import.meta.dir, `../src/${entry}.ts`)],
      outdir,
      target,
      format: 'esm',
      splitting: entry === 'bun', // keeps bun:ffi in a chunk loaded only for the native kernel
      sourcemap: 'linked',
      naming: { entry: '[name].js', chunk: '[name]-[hash].js' },
    });
    if (!result.success) throw new AggregateError(result.logs, `Bundling ${entry} failed`);
  }
  const packageDirectory = path.join(import.meta.dir, '..');
  await $`${path.join(packageDirectory, 'node_modules/.bin/tsc')} -p tsconfig.build.json`.cwd(
    packageDirectory,
  );
  console.log(`wrote ${outdir}`);
}

if (targets.length === 0 || targets.includes('native')) {
  await $`cargo build -p tscad-kernel --release`.cwd(root);
  const built = path.join(root, 'target/release', nativeLibraryPath.split(/[\\/]/).pop()!);
  await Bun.write(nativeLibraryPath, Bun.file(built));
  console.log(`wrote ${nativeLibraryPath} (${await megabytes(nativeLibraryPath)})`);
}

if (targets.length === 0 || targets.includes('wasm')) {
  const image = 'ghcr.io/lzpel/cross-wasm32-unknown-unknown';
  // Separate target dir: the container's host-side build scripts are Linux binaries.
  const targetDirectory = 'target/docker';
  const dockerArguments = [
    'run',
    '--rm',
    '--platform',
    'linux/amd64',
    '-v',
    `${root}:/work`,
    '-w',
    '/work',
    '-v',
    'tscad-cargo-registry:/root/.cargo/registry',
    '-e',
    'CARGO_PROFILE_RELEASE_STRIP=true',
    image,
    'cargo',
    'build',
    '-p',
    'tscad-kernel',
    '--release',
    '--target-dir',
    targetDirectory,
  ];
  await $`docker ${dockerArguments}`;

  const destination = path.join(import.meta.dir, '../kernel.wasm');
  await Bun.write(
    destination,
    Bun.file(path.join(root, targetDirectory, 'wasm32-unknown-unknown/release/tscad_kernel.wasm')),
  );
  console.log(`wrote ${destination} (${await megabytes(destination)})`);
}
