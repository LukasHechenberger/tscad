import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/*.ts', '!src/*.test.ts'],
  format: 'esm',
  outDir: 'out',
  dts: true,
});
