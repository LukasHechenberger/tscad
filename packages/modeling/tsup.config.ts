import { defineConfig } from 'tsup';
import path from 'path';

export default defineConfig({
  entry: ['src/index.ts', 'src/*/*.ts'],
  format: ['esm', 'cjs'],
  outDir: 'out',
  dts: true,
  sourcemap: true,
});
