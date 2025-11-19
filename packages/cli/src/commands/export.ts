import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';
import * as threeMf from '@jscad/3mf-serializer';
import * as obj from '@jscad/obj-serializer';
import * as stl from '@jscad/stl-serializer';
import { Command } from '@tscad/commander';
import open from 'open';
import { rootDebug } from '@/lib/log';

const debug = rootDebug.extend('export');

const coders = {
  '.3mf': { ...threeMf, options: {} },
  '.stl': { ...stl, options: { binary: true } },
  '.obj': { ...obj, options: {} },
};

export const exportCommand = new Command('export')
  .usage('[options] [params...]')
  .description('Export the model to a file')
  .option('--model [model]', 'Where to find the tscad model', './src/model.ts')
  .option('--parts', 'Export each part to a separate file', false)
  .option('--output <filename>', 'The output file', './out/model.stl')
  .option('--slice <slicer>', 'Open the result in a slicer', false)
  .action(async function runExportCommand({
    model,
    processedModel,
    modelProcessingError,
    ...options
  }) {
    // If there was an error processing the model, show it and exit
    if (modelProcessingError) this.error(modelProcessingError);

    // eslint-disable-next-line no-console
    console.log(`🫡  Exporting model at ${path.relative(process.cwd(), model)}...`);

    const outPath = path.join(process.cwd(), options.output);
    const outPathExtname = path.extname(outPath);

    const coder = coders[outPathExtname.toLowerCase() as keyof typeof coders];
    if (!coder) this.error(`Unsupported output file type: ${outPathExtname}`);
    debug(`Using coder: ${coder.mimeType}`);

    let geometry = processedModel;

    if (typeof geometry['render'] === 'function') {
      debug('Rendering model');

      // eslint-disable-next-line unicorn/no-await-expression-member
      geometry = (await geometry.render(options)).solids;
      debug('Model rendered');
    } else {
      // eslint-disable-next-line no-console
      console.warn(styleText(['yellow'], `ℹ️  Model has no render() method.`));
    }

    const parts = Array.isArray(geometry) ? geometry : [geometry];
    if (parts.length === 0) {
      this.error(`Model did not return any geometry to export.`);
    }

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
      let data;
      try {
        data = coder.serialize(coder.options, geometry);
      } catch (error) {
        this.error(`Failed to serialize model: ${(error as Error).message}`);
      }
      debug('Model serialized');

      debug('Writing to file');
      const blob = new Blob(data, { type: coder.mimeType });

      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, Buffer.from(await blob.arrayBuffer()));
      debug('File written to', path.relative(process.cwd(), outPath));

      // eslint-disable-next-line no-console
      console.log(` → 👍 Exported ${name} to ${path.relative(process.cwd(), outPath)}`);
    }

    if (options.slice) {
      // NOTE: Only the first part is opened in the slicer
      const fileToOpen = exports[0]!.outPath;

      // eslint-disable-next-line no-console
      console.log(`🖥  Opening in slicer: ${path.relative(process.cwd(), fileToOpen)}`);
      await open(fileToOpen, { app: { name: options.slice } });
    }

    // eslint-disable-next-line no-console
    console.log('🎉 All done!');
  });
