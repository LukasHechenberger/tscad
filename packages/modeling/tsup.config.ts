import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addSeeTagPlugin } from 'esbuild-autodoc';
import { defineConfig } from 'tsup';
import { devDependencies } from './package.json';

export default defineConfig([
  {
    entry: ['src/scripts/*.ts'],
    external: Object.keys(devDependencies),
    outDir: 'out/scripts',
    format: 'esm',
    // onSuccess: 'node ./out/scripts/update-readme.js',
    onSuccess: 'node ./out/scripts/update-api-docs.js',
  },
  {
    entry: ['src/*.ts', 'src/*/index.ts'],
    format: ['esm', 'cjs'],
    outDir: 'out',
    dts: true,
    sourcemap: true,
    esbuildPlugins: [
      addSeeTagPlugin({
        baseUrl: 'https://tscad.vercel.app/docs/api/modeling/',
        getPathname: (source, name) => {
          if (!source.includes('/primitives/')) return;
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

            const exports: [string, Record<string, string | Record<string, string>>][] = [];

            for (const file of outputFiles) {
              // Only handle esm files to just do it once
              if (file.path.endsWith('.js') && !file.path.includes('/scripts/')) {
                const relativePath = `./${path.relative(process.cwd(), file.path)}`;

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

            if (exports.length > 0) {
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
  },
  {
    entry: ['src/index.ts', 'src/*/index.ts'],
    format: 'esm',
    outDir: 'out/standalone',
    external: [],
    noExternal: ['@jscad/modeling'],
  },
]);
