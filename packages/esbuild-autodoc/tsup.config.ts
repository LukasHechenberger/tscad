import { defineConfig } from 'tsup';

export default defineConfig(({ watch }) => ({
  entry: ['src/*.ts'],
  format: 'esm',
  outDir: 'out',
  dts: true,
}));
