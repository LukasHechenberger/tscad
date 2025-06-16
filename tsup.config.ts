import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scripts/*.ts', 'src/examples.ts'],
  format: ['esm', 'cjs'],
  outDir: 'out',
  dts: true,
  sourcemap: true,
  clean: false,
  onSuccess: 'node ./out/scripts/build-examples.js',
});
