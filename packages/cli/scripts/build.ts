/**
 * Builds the CLI into out/ (`--watch`: again on every change in src/):
 *
 * - `bin.js`, and `eval-model.js` (spawned by `tscad dev` for every re-evaluation), bundled for Bun
 *   with their dependencies external.
 * - The preview page (scripts/build-preview.ts) and the command reference in the docs and README
 *   (scripts/update-documentation.ts).
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
  const result = await Bun.build({
    entrypoints: ['src/bin.ts', 'src/eval-model.ts'].map((entry) =>
      path.join(packageDirectory, entry),
    ),
    outdir,
    target: 'bun',
    format: 'esm',
    packages: 'external',
    splitting: true,
    sourcemap: 'linked',
    naming: { entry: '[name].js', chunk: 'chunk-[hash].js' },
  });
  if (!result.success) throw new AggregateError(result.logs, 'Bundling the CLI failed');
  console.log(`wrote ${outdir}`);

  await $`bun scripts/build-preview.ts`.cwd(packageDirectory);
  await $`bun scripts/update-documentation.ts`.cwd(packageDirectory);
}

await build();

if (Bun.argv.includes('--watch')) {
  let timer: Timer | undefined;
  watch(path.join(packageDirectory, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((error: unknown) => console.error(error)), 100);
  });
}
