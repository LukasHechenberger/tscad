import { defineConfig } from 'tsup';

export default defineConfig(({ watch }) => ({
  entry: ['./src/bin.ts'],
  outDir: './out',
  format: ['esm'],
  onSuccess: 'pnpm -s build:readme',
}));
