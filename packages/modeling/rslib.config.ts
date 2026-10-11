import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    tsconfigPath: './tsconfig.build.json',
    entry: {
      index: './src/index.ts',
    },
  },
  lib: [
    {
      id: 'esm',
      format: 'esm',
      syntax: 'es2022',
      dts: true,
    },
    {
      id: 'cjs',
      format: 'cjs',
      syntax: 'es2022',
      dts: false,
    },
    {
      // A self-contained ES module, e.g. for the docs playground.
      id: 'standalone',
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      autoExternal: false,
      output: {
        distPath: 'out/standalone',
      },
    },
  ],
  output: {
    distPath: 'out',
    target: 'web',
    sourceMap: true,
  },
});
