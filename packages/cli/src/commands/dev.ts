import { existsSync } from 'node:fs';
import path from 'node:path';
import { styleText } from 'node:util';
import { InvalidArgumentError, Option } from '@tscad/commander';
import open from 'open';
import { ModelCommand } from '@/lib/commander';
import { startPreview } from '@/lib/preview';
import { version } from '../../package.json';

async function openVscodePreview(port?: number) {
  await open(`vscode://tscad.tscad-vscode${port ? `?port=${port}` : ''}`, { wait: false });
}

// eslint-disable-next-line no-console
const log = (message: string) => console.info(styleText(['dim'], `  ${message}`));

function parseIntArgument(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isNaN(parsedValue)) throw new InvalidArgumentError('not a number.');

  return parsedValue;
}

export const devCommand = new ModelCommand('dev')
  .description(
    'Start the development server, a live 3D preview with a parameter form that re-renders on save',
  )
  .addOption(
    new Option('-p, --port <port>', 'The port to listen at')
      .argParser(parseIntArgument)
      .default(4000)
      .env('PORT'),
  )
  .addOption(new Option('--open', 'Open the browser once started').default(false).env('OPEN'))
  .action(async function runDevelopmentCommand({ model, port, open: openBrowser }) {
    const modelPath = path.join(process.cwd(), model);
    if (!existsSync(modelPath)) {
      this.error(`Model file not found: ${model}`, { code: 'ENOENT' });
    }

    // eslint-disable-next-line no-console
    console.info(
      `${styleText(['bold'], `Starting ${styleText(['magenta'], 'tscad dev')}`)} ${styleText(['dim'], `v${version}`)}\n`,
    );

    const { server, editor } = await startPreview(modelPath, { port, log });

    // eslint-disable-next-line no-console
    console.info(
      `  ${styleText(['bold', 'green'], '→')}  ${styleText(['bold'], 'Model')}:   ${styleText(['cyan'], path.relative(process.cwd(), modelPath))}`,
    );
    // eslint-disable-next-line no-console
    console.info(
      `  ${styleText(['bold', 'green'], '→')}  ${styleText(['bold'], 'Preview')}: ${styleText(['cyan'], server.url.href)}${editor ? styleText(['dim'], ` (files open in ${editor.name})`) : ''}\n`,
    );

    if (openBrowser) await open(server.url.href);

    // Try to open vscode preview if terminal is vscode
    if (process.env.TERM_PROGRAM === 'vscode') {
      // eslint-disable-next-line no-console
      console.info(styleText(['dim'], `  →  opening preview in vscode...`));
      await openVscodePreview(server.port);
    }
  });
