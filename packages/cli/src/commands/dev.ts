import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import viteReact from '@vitejs/plugin-react';
import { Command } from 'commander';
import { createServer } from 'vite';

const { dirname, join } = path;
const { resolve } = createRequire(import.meta.url);

export const devCommand = new Command('dev')
  .description('Start the development server')
  .argument('[model]', 'Model file to serve', 'model.ts')
  .option('-p, --port <port>', 'The port to listen to. Defaults to 4000')
  .option('--open', 'Open the browser after the server is started', false)
  .action(async (model, options) => {
    const explicitPortString = options.port || process.env.PORT;
    const explicitPort = explicitPortString ? Number.parseInt(explicitPortString, 10) : undefined;

    const modelPath = join(process.cwd(), model);
    console.debug('Using model path', modelPath);

    if (!existsSync(modelPath)) {
      throw new Error(`Model file not found: ${model}`);
    }

    const root = join(dirname(resolve('@tscad/viewer/package.json')), 'src/vite-template');
    console.debug('Using root', root);

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

    server.printUrls();
    server.bindCLIShortcuts({ print: true });
  });
