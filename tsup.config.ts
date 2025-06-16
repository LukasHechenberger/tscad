import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  outDir: 'out',
  dts: true,
  sourcemap: true,
  clean: false,
  onSuccess: 'pnpm jscad out/index.js -o out/index.jscad.json',
});
