import { defineConfig } from '@rslib/core';

export default defineConfig({
  output: { distPath: 'out', sourceMap: true },
  lib: [{ format: 'esm', dts: true }],
});
