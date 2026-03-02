import { defineConfig } from '@rslib/core';
import { pluginRsbuildExec } from 'rsbuild-exec';

export default defineConfig({
  output: {
    distPath: 'out',
  },
  source: {
    entry: {
      bin: './src/bin.ts',
    },
  },
  plugins: [
    pluginRsbuildExec({
      title: 'readme',
      command:
        'bun update-section README.md usage "\\`\\`\\`\n$(bun out/bin.js --help)\n\\`\\`\\`"',
      options: { shell: true },
    }),
  ],
  lib: [{ format: 'esm' }],
});
