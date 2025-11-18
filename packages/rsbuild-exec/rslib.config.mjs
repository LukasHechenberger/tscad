import { defineConfig } from '@rslib/core';
import { pluginRsbuildExec } from './src';

export default defineConfig({
  output: { distPath: 'out', sourceMap: true },
  lib: [{ format: 'esm', dts: true }],
  plugins: [
    pluginRsbuildExec({
      command: 'node ../scripts/out/build-api-docs.js',
      title: 'api-docs',
    }),
  ],
});
