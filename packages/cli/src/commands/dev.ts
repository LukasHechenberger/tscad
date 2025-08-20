import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Command } from '@tscad/commander';
import viteReact from '@vitejs/plugin-react';
import open from 'open';
import { createServer } from 'vite';
import { homepage } from '../../package.json';

const { dirname, join, relative } = path;
const { resolve } = createRequire(import.meta.url);

async function openVscodePreview() {
  await open(`vscode://tscad.tscad-vscode`, { wait: false });
}

export const devCommand = new Command('dev')
  .description('Start the development server')
  .argument('[model]', 'model file to serve', 'src/model.ts')
  .option('-p, --port <port>', 'the port to listen at (default: 4000)')
  .option('--open', 'open the browser once started', false)
  .action(async function runDevelopmentCommand(model, options) {
    const explicitPortString = options.port || process.env.PORT;
    const explicitPort = explicitPortString ? Number.parseInt(explicitPortString, 10) : undefined;

    const modelPath = join(process.cwd(), model);
    if (!existsSync(modelPath)) {
      this.error(`Model file not found: ${model}`);
    }
    console.debug('Model', relative(process.cwd(), modelPath));

    const root = join(dirname(resolve('@tscad/viewer/package.json')), 'src/vite-template');
    console.debug('Using root', relative(process.cwd(), root));

    const server = await createServer({
      configFile: false,
      plugins: [viteReact()],
      resolve: {
        alias: {
          '@tscad-viewer/model': modelPath,
        },
      },
      root,
      server: {
        port: explicitPort ?? 4000,
        open: options.open,
      },
    });

    await server.listen();

    // Try to open vscode preview if terminal is vscode
    if (process.env.TERM_PROGRAM === 'vscode') {
      await openVscodePreview();
    }

    server.printUrls();

    server.bindCLIShortcuts({
      print: true,
      customShortcuts: [
        {
          key: 'v',
          description: 'open vscode preview',
          async action() {
            await openVscodePreview();
          },
        },
        {
          key: 'd',
          description: 'open documentation',
          async action() {
            await open(homepage);
          },
        },
      ],
    });
  });
