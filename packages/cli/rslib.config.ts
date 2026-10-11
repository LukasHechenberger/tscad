import { defineConfig } from '@rslib/core';
import { pluginExec } from 'rsbuild-exec';

export default defineConfig({
  source: {
    entry: {
      bin: './src/bin.ts',
      // Spawned by `tscad dev` for every re-evaluation.
      'eval-model': './src/eval-model.ts',
    },
  },
  output: {
    distPath: './out',
    target: 'node',
    sourceMap: true,
  },
  lib: [{ id: 'lib', format: 'esm' }],
  plugins: [
    pluginExec({
      title: 'preview',
      command: 'bun ./scripts/build-preview.ts',
    }),
    pluginExec({
      title: 'api-docs',
      command: 'bun ./scripts/update-documentation.ts',
    }),
  ],
});
