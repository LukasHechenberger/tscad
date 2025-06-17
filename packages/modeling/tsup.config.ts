import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/*/*.ts'],
  format: ['esm', 'cjs'],
  outDir: 'out',
  dts: true,
  sourcemap: true,
  esbuildPlugins: [
    {
      name: 'add-exports',
      setup({ onEnd }) {
        onEnd(async ({ outputFiles }) => {
          if (!outputFiles) {
            console.warn('No output files found');
            return;
          }

          const exports: [string, Record<string, string | Record<string, string>>][] = [];

          for (const file of outputFiles) {
            // Only handle esm files to just do it once
            if (file.path.endsWith('.js')) {
              const relativePath = `./${path.relative(process.cwd(), file.path)}`;
              let exportPath = path.dirname(path.relative('out', relativePath));

              if (!exportPath.startsWith('.')) exportPath = `./${exportPath}`;

              exports.push([
                exportPath,
                {
                  types: relativePath.replace(/\.js$/, '.d.ts'),
                  default: relativePath,
                },
              ]);
            }
          }

          if (exports.length > 0) {
            const manifest = JSON.parse(await readFile('package.json', 'utf8'));
            manifest.exports = Object.fromEntries(exports);
            console.log('EXPORTS', manifest.exports);

            await writeFile('package.json', `${JSON.stringify(manifest, undefined, 2)}\n`);
          }
        });
      },
    },
  ],
});
