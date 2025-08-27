import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addSeeTagPlugin } from 'esbuild-autodoc';
import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/*.ts', 'src/*/index.ts', 'src/scripts/*.ts'],
    format: ['esm', 'cjs'],
    outDir: 'out',
    dts: true,
    sourcemap: true,
    esbuildPlugins: [
      addSeeTagPlugin({
        baseUrl: 'https://tscad.vercel.app/docs/modeling/',
        getPathname: (source, name) => {
          console.log(`Generating documentation for ${name} in ${source}`);
          return `${path.relative('src', path.dirname(source))}#${name}`;
        },
      }),
      {
        name: 'add-exports',
        setup({ onEnd }) {
          onEnd(async ({ outputFiles }) => {
            if (!outputFiles) {
              console.warn('No output files found');
              return;
            }

            const exports: [string, string | Record<string, string | Record<string, string>>][] = [
              ['./package.json', './package.json'],
            ];

            for (const file of outputFiles) {
              // Only handle esm files to just do it once
              if (file.path.endsWith('.js') && !file.path.includes('/scripts/')) {
                const relativePath = `./${path.relative(process.cwd(), file.path)}`;

                const sourcePath = path
                  .join(process.cwd(), 'src/', path.relative('out', relativePath))
                  .replaceAll('.js', '.ts');

                if (!existsSync(sourcePath)) {
                  console.debug('Skipping non-source file', file.path);
                  continue;
                }

                let exportPath =
                  path
                    .relative('out', relativePath)
                    .replace(/(\/index)?.js$/, '')
                    .replace('index', '') || '.';

                if (!exportPath.startsWith('.')) exportPath = `./${exportPath}`;

                exports.push([
                  exportPath,
                  {
                    require: {
                      types: relativePath.replace(/\.js$/, '.d.cts'),
                      default: relativePath.replace(/\.js$/, '.cjs'),
                    },
                    types: relativePath.replace(/\.js$/, '.d.ts'),
                    default: relativePath,
                  },
                ]);
              }
            }

            if (exports.length > 1) {
              const manifest = JSON.parse(await readFile('package.json', 'utf8'));
              manifest.exports = Object.fromEntries(
                exports.sort((a, b) => a[0].localeCompare(b[0])),
              );

              console.log(`EXP Added ${exports.length} exports to package.json`);
              await writeFile('package.json', `${JSON.stringify(manifest, undefined, 2)}\n`);
            }
          });
        },
      },
    ],
    onSuccess: 'node ./out/scripts/update-readme.js',
  },
]);
