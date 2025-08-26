import { defineConfig } from 'tsup';

export default defineConfig(({ watch }) => [
  {
    entry: ['./src/bin.ts', './src/api.ts'],
    outDir: './out',
    format: ['esm'],
    onSuccess: ['pnpm -s build:readme', watch && 'pnpm -s dev:on-success']
      .filter(Boolean)
      .join('&&'),
    dts: true,
  },
  {
    entry: ['./src/scripts/*.ts'],
    outDir: './out/scripts',
    format: ['esm'],
    onSuccess: 'FORCE_COLOR=1 node ./out/scripts/update-documentation.js',
  },
]);
