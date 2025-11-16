import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      'build-api-docs': './src/build-api-docs.ts',
    },
  },
  lib: [{ format: 'esm', syntax: 'es2022' }],
  output: {
    distPath: 'out',
  },
});
