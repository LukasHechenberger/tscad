import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as threeMf from '@jscad/3mf-serializer';
import * as obj from '@jscad/obj-serializer';
import * as stl from '@jscad/stl-serializer';
import { Command } from '@tscad/commander';
import { build } from 'esbuild';
import open from 'open';
import { rootDebug } from '@/lib/log';

const debug = rootDebug.extend('export');

const coders = {
  '.3mf': { ...threeMf, options: {} },
  '.stl': { ...stl, options: { binary: true } },
  '.obj': { ...obj, options: {} },
};

export const exportCommand = new Command('export')
  .description('Export the model to a file')
  .argument('[model]', 'Where to find the tscad model', './src/model.ts')
  .option('--parts', 'Export each part to a separate file', false)
  .option('--output <filename>', 'The output file', 'out/model.stl')
  .option('--slice <slicer>', 'Open the result in a slicer', false)
  .action(async function runExportCommand(model, options) {
    console.log(`🫡  Exporting model at ${path.relative(process.cwd(), model)}...`);
    debug(`Exporting model from ${model} to ${options.output}`);

    const sourcePath = path.join(process.cwd(), model);
    const outPath = path.join(process.cwd(), options.output);
    const outPathExtname = path.extname(outPath);

    const coder = coders[outPathExtname.toLowerCase() as keyof typeof coders];
    if (!coder) this.error(`Unsupported output file type: ${outPathExtname}`);
    debug(`Using coder: ${coder.mimeType}`);

    let importPath = sourcePath;

    if (model.endsWith('.ts')) {
      importPath = outPath.replace(outPathExtname, '.mjs');

      debug('Building model...');
      await build({
        entryPoints: [sourcePath],
        bundle: true,
        format: 'esm',
        outfile: importPath,
      });
      debug('Model built to', path.relative(process.cwd(), importPath));
    }

    debug('Loading model');
    let geometry = await import(importPath).then((module_) => module_.default ?? module_.main);

    if (typeof geometry === 'function') {
      debug('Executing model function');
      geometry = await geometry();
    }

    debug('Model loaded');

    const parts = Array.isArray(geometry) ? geometry : [geometry];
    const exports = options.parts
      ? parts.map((part, index) => {
          const partName = part.name ?? `part-${index}`;

          return {
            name: partName,
            outPath: outPath.replace(
              new RegExp(`${outPathExtname}$`),
              `-${partName}${outPathExtname}`,
            ),
            geometry: part,
          };
        })
      : [{ outPath, name: 'model', geometry: parts }];

    for (const { geometry, name, outPath } of exports) {
      debug('Serializing model');
      const data = coder.serialize(coder.options, geometry);
      debug('Model serialized');

      debug('Writing to file');
      const blob = new Blob(data, { type: coder.mimeType });

      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, Buffer.from(await blob.arrayBuffer()));
      debug('File written to', path.relative(process.cwd(), outPath));

      console.log(`  👍 Exported ${name} to ${path.relative(process.cwd(), outPath)}`);
    }

    if (options.slice) {
      // NOTE: Only the first part is opened in the slicer
      const fileToOpen = exports[0]!.outPath;
      console.log(`🖥  Opening in slicer: ${path.relative(process.cwd(), fileToOpen)}`);
      await open(fileToOpen, { app: { name: options.slice } });
    }

    console.log('🎉 All done!');
  });
