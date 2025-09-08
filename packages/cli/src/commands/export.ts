import { writeFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import * as threeMf from '@jscad/3mf-serializer';
import * as obj from '@jscad/obj-serializer';
import * as stl from '@jscad/stl-serializer';
import { Command } from '@tscad/commander';
import { build } from 'esbuild';
import open from 'open';

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
    console.log('Exporting model from', model, 'to', options.output);

    const sourcePath = join(process.cwd(), model);
    const outPath = join(process.cwd(), options.output);

    const coder = coders[extname(outPath).toLowerCase() as keyof typeof coders];
    if (!coder) this.error(`Unsupported output file type: ${extname(outPath)}`);
    console.log('Using coder:', coder.mimeType);

    let importPath = sourcePath;

    if (model.endsWith('.ts')) {
      importPath = outPath.replace(extname(outPath), '.mjs');

      console.time('Build model');
      await build({
        entryPoints: [sourcePath],
        bundle: true,
        format: 'esm',
        outfile: importPath,
      });
      console.timeEnd('Build model');
    }

    console.time('Load model');
    const geometry = await import(importPath).then((module_) => module_.default);
    console.timeEnd('Load model');

    console.time('Serialize model');
    const data = coder.serialize(coder.options, ...geometry);
    console.timeEnd('Serialize model');

    console.time('Write file');
    const blob = new Blob(data, { type: coder.mimeType });

    await writeFile(outPath, Buffer.from(await blob.arrayBuffer()));
    console.timeEnd('Write file');

    console.log(`Exported model to ${relative(process.cwd(), outPath)}`);

    if (options.slice) {
      await open(outPath, { app: { name: options.slice } });
    }
  });
