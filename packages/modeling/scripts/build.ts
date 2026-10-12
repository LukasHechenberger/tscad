/**
 * Builds the package into out/ (`--watch`: again on every change in src/):
 *
 * - `index.js` (ES module) and `index.cjs` (CommonJS), bundled with Bun.build.
 * - `standalone/index.js`: a self-contained ES module, e.g. for the docs playground.
 * - Declarations next to them (`index.d.ts`, …), by tsc.
 */
/* eslint-disable no-console -- a build script reporting what it wrote */

import { watch } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { $ } from 'bun';

const packageDirectory = path.join(import.meta.dir, '..');
const outdir = path.join(packageDirectory, 'out');

async function build() {
  await rm(outdir, { recursive: true, force: true });
  for (const [format, directory, extension, packages] of [
    ['esm', outdir, '.js', 'external'],
    ['cjs', outdir, '.cjs', 'external'],
    ['esm', path.join(outdir, 'standalone'), '.js', 'bundle'],
  ] as const) {
    const result = await Bun.build({
      entrypoints: [path.join(packageDirectory, 'src/index.ts')],
      outdir: directory,
      target: 'browser',
      format,
      packages,
      sourcemap: 'linked',
      naming: `[name]${extension}`,
    });
    if (!result.success) throw new AggregateError(result.logs, `Bundling ${format} failed`);
  }
  await $`${path.join(packageDirectory, 'node_modules/.bin/tsc')} -p tsconfig.build.json`.cwd(
    packageDirectory,
  );
  console.log(`wrote ${outdir}`);
}

await build();

if (Bun.argv.includes('--watch')) {
  let timer: Timer | undefined;
  watch(path.join(packageDirectory, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((error: unknown) => console.error(error)), 100);
  });
}
