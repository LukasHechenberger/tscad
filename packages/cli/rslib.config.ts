import { defineConfig } from '@rslib/core';
import { pluginExec } from 'rsbuild-exec';

export default defineConfig({
  source: {
    entry: {
      bin: './src/bin.ts',
      'scripts/update-documentation': './src/scripts/update-documentation.ts',
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
      title: 'api-docs',
      command: 'node --enable-source-maps ./out/scripts/update-documentation.js',
    }),
  ],
});
