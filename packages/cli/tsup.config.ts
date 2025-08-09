import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['./src/bin.ts'],
  outDir: './out',
  format: ['esm'],
  onSuccess: 'pnpm update-section README.md usage "$(node out/bin.js --help)"',
});
