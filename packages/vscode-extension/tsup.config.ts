import { defineConfig } from 'tsup';

export default defineConfig(() => ({
  entry: ['./src/extension.ts'],
  outDir: './out',
  format: ['cjs'],
  external: ['vscode'],
  dts: true,
}));
