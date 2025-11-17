import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      extension: './src/extension.ts',
    },
  },
  output: {
    distPath: './out',
    externals: ['vscode'],
  },
  lib: [
    { format: 'cjs' },
    {
      format: 'esm',
      source: {
        entry: {
          test: ['./src/test/*.ts'],
        },
      },
      bundle: false,
    },
  ],
});
