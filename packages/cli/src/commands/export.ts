import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { serialize as toStl } from '@jscad/stl-serializer';
import { Command } from '@tscad/commander';
import { build } from 'esbuild';

export const exportCommand = new Command('export')
  .description('Export the model to a file')
  .argument('[model]', 'Where to find the tscad model', './src/model.ts')
  .option('--output', 'The output file', 'out/model.stl')
  .action(async function runExportCommand(model, options) {
    const sourcePath = join(process.cwd(), model);
    const outPath = join(process.cwd(), options.output);

    let importPath = sourcePath;

    if (model.endsWith('.ts')) {
      importPath = outPath.replace(/\.stl$/, '.mjs');

      await build({
        entryPoints: [sourcePath],
        bundle: true,
        format: 'esm',
        outfile: importPath,
      });
    }

    const geometry = await import(importPath).then((module_) => module_.default);

    const stlData = toStl({ binary: true }, geometry);

    const blob = new Blob(stlData, { type: 'application/sla' });

    await writeFile(outPath, Buffer.from(await blob.arrayBuffer()));
  });
