/**
 * Builds the extension into out/ (`--watch`: again on every change in src/):
 *
 * - `extension.js`: the extension, a minified CommonJS bundle for VS Code's Node.js.
 * - `test/*.test.mjs`: the integration tests, run by `vscode-test` (.vscode-test.mjs).
 */
/* eslint-disable no-console -- a build script reporting what it wrote */

import { watch } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Glob } from 'bun';

const packageDirectory = path.join(import.meta.dir, '..');
const outdir = path.join(packageDirectory, 'out');

async function build() {
  await rm(outdir, { recursive: true, force: true });
  const tests = await Array.fromAsync(
    new Glob('src/test/*.test.ts').scan({ cwd: packageDirectory, absolute: true }),
  );
  const builds: Bun.BuildConfig[] = [
    {
      entrypoints: [path.join(packageDirectory, 'src/extension.ts')],
      outdir,
      format: 'cjs',
      minify: true,
    },
    {
      entrypoints: tests,
      outdir: path.join(outdir, 'test'),
      format: 'esm',
      naming: '[name].mjs',
    },
  ];
  for (const options of builds) {
    const result = await Bun.build({
      ...options,
      target: 'node',
      external: ['vscode'],
      sourcemap: 'linked',
    });
    if (!result.success) throw new AggregateError(result.logs, 'Bundling the extension failed');
  }
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
