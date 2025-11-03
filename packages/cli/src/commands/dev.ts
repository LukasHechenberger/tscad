import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { styleText } from 'node:util';
import { Command, InvalidArgumentError, Option } from '@tscad/commander';
import viteReact from '@vitejs/plugin-react';
import open from 'open';
import { createServer } from 'vite';
import { rootDebug } from '@/lib/log';
import { homepage, version } from '../../package.json';

const { dirname, join, relative } = path;
const { resolve } = createRequire(import.meta.url);

const debug = rootDebug.extend('dev');

async function openVscodePreview(port?: number) {
  await open(`vscode://tscad.tscad-vscode${port ? `?port=${port}` : ''}`, { wait: false });
}

function parseIntArgument(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) throw new InvalidArgumentError('not a number.');

  return parsedValue;
}

export const devCommand = new Command('dev')
  .description('Start the development server')
  .argument('[model]', 'Where to find the tscad model', 'src/model.ts')
  .addOption(
    new Option('-p, --port <port>', 'The port to listen at')
      .argParser(parseIntArgument)
      .default(4000)
      .env('PORT'),
  )
  .addOption(new Option('--open', 'Open the browser once started').default(false).env('OPEN'))
  .action(async function runDevelopmentCommand(model, { ...serverOptions }) {
    const modelPath = join(process.cwd(), model);
    if (!existsSync(modelPath)) {
      this.error(`Model file not found: ${model}`, { code: 'ENOENT' });
    }

    console.info(
      `${styleText(['bold'], `Starting ${styleText(['magenta'], 'tscad dev')}`)} ${styleText(['dim'], `v${version}`)}\n`,
    );

    const root = join(dirname(resolve('@tscad/viewer/package.json')), 'src/vite-template');
    debug('Using root', relative(process.cwd(), root));

    const server = await createServer({
      configFile: false,
      plugins: [viteReact()],
      resolve: {
        alias: {
          '@tscad-viewer/model': modelPath,
        },
      },
      root,
      server: { ...serverOptions, host: false }, // NOTE: We could also add a --host option
    });

    await server.listen();

    console.info(
      `  ${styleText(['bold', 'green'], '→')}  ${styleText(['bold'], 'Model')}:   ${styleText(['cyan'], relative(process.cwd(), modelPath))}`,
    );
    server.printUrls();

    // Try to open vscode preview if terminal is vscode
    if (process.env.TERM_PROGRAM === 'vscode') {
      console.info(styleText(['dim'], `  →  opening preview in vscode...`));
      await openVscodePreview(serverOptions.port);
    }

    server.bindCLIShortcuts({
      print: true,
      customShortcuts: [
        {
          key: 'v',
          description: 'open vscode preview',
          async action() {
            await openVscodePreview(serverOptions.port);
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
    console.info('');
  });
