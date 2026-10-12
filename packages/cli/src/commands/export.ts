import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FORMATS, type Format, loadKernel } from '@tscad/kernel';
import open from 'open';
import { buildModel, type ModelOptions } from '@/lib/build';
import { ModelCommand } from '@/lib/commander';
import { rootDebug } from '@/lib/log';
import { loadPlugins } from '@/lib/plugins';

const debug = rootDebug.extend('export');

export const exportCommand = new ModelCommand('export')
  .description(
    `Export the model to a file (.${FORMATS.join(', .')}, or a format an exporter plugin adds, e.g. .3mf)`,
  )
  .option('--output <filename>', 'The output file', './out/model.stl')
  .option('--slice <slicer>', 'Open the result in a slicer', false)
  .action(async function runExportCommand({
    model,
    modelProcessingError,
    output,
    slice,
    ...options
  }) {
    // If there was an error processing the model, show it and exit
    if (modelProcessingError)
      this.error(String((modelProcessingError as Error).message ?? modelProcessingError));

    // eslint-disable-next-line no-console
    console.log(`🫡  Exporting model at ${path.relative(process.cwd(), model)}...`);

    const outPath = path.resolve(output);
    const extension = path.extname(outPath).slice(1).toLowerCase();

    const kernel = await loadKernel();
    const host = await loadPlugins(kernel, path.dirname(model));
    const builtIn = FORMATS.includes(extension as Format);
    if (!builtIn && !host.exporterFor(extension)) {
      const plugins = host
        .list()
        .flatMap((plugin) => (plugin.fileExtension ? [`.${plugin.fileExtension}`] : []));
      this.error(
        `Unsupported output file type: .${extension} (built in: .${FORMATS.join(', .')}${plugins.length > 0 ? `; plugins: ${plugins.join(', ')}` : ''})`,
      );
    }

    let data: Uint8Array;
    try {
      const shape = await buildModel(options as ModelOptions);
      debug(`Rendering with the ${kernel.backend} kernel`);
      data = builtIn
        ? kernel.render(await host.lower(shape.node), extension as Format)
        : await host.export(shape.node, extension);
    } catch (error) {
      this.error(`Failed to export model: ${(error as Error).message}`);
    }

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, data);
    debug('File written to', path.relative(process.cwd(), outPath));

    // eslint-disable-next-line no-console
    console.log(` → 👍 Exported model to ${path.relative(process.cwd(), outPath)}`);

    if (slice) {
      // eslint-disable-next-line no-console
      console.log(`🖥  Opening in slicer: ${path.relative(process.cwd(), outPath)}`);
      await open(outPath, { app: { name: slice } });
    }

    // eslint-disable-next-line no-console
    console.log('🎉 All done!');
  });
