import { writeFile } from 'node:fs/promises';
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
  .option('--output <filename>', 'The output file', 'out/model.3mf')
  .option('--slice <slicer>', 'Open the result in a slicer', false)
  .action(async function runExportCommand(model, options) {
    debug(`Exporting model from ${model} to ${options.output}`);

    const sourcePath = path.join(process.cwd(), model);
    const outPath = path.join(process.cwd(), options.output);

    const coder = coders[path.extname(outPath).toLowerCase() as keyof typeof coders];
    if (!coder) this.error(`Unsupported output file type: ${path.extname(outPath)}`);
    debug(`Using coder: ${coder.mimeType}`);

    let importPath = sourcePath;

    if (model.endsWith('.ts')) {
      importPath = outPath.replace(path.extname(outPath), '.mjs');

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
    const geometry = await import(importPath).then((module_) => module_.default);
    debug('Model loaded');

    debug('Serializing model');
    const data = coder.serialize(coder.options, geometry);
    debug('Model serialized');

    debug('Writing to file');
    const blob = new Blob(data, { type: coder.mimeType });

    await writeFile(outPath, Buffer.from(await blob.arrayBuffer()));
    debug('File written to', path.relative(process.cwd(), outPath));

    console.log(`👍 Exported model to ${path.relative(process.cwd(), outPath)}`);

    if (options.slice) {
      await open(outPath, { app: { name: options.slice } });
    }
  });
