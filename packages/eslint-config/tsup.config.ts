import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['*.js', '!eslint.config.js'],
  format: 'cjs',
  outDir: '.',
});
