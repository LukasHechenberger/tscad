import { defineConfig } from '@rslib/core';
import { pluginRsbuildExec } from './src';

export default defineConfig({
  output: { distPath: 'out', sourceMap: true },
  lib: [{ format: 'esm', dts: true }],
  plugins: [
    pluginRsbuildExec({
      command: 'echo "Hello, World!"',
      title: 'my-command',
    }),
  ],
});
