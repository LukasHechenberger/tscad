import { defineConfig } from '@rslib/core';
import { pluginRsbuildExec } from 'rsbuild-exec';

export default defineConfig((c) => ({
  source: {
    entry: {
      index: './src/index.ts',
      examples: './src/examples.ts',
      'scripts/build-examples': './src/scripts/build-examples.ts',
    },
  },
  output: {
    distPath: './out',
    sourceMap: true,
  },
  lib: [
    { format: 'esm' },
    {
      format: 'cjs',
      plugins: [
        pluginRsbuildExec({
          title: 'examples',
          command: `node --enable-source-maps ./out/scripts/build-examples.js ${c.envMode}`,
          options: { shell: true },
        }),
      ],
    },
  ],
}));
