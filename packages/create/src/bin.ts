#!/usr/bin/env node

import path from 'node:path';
import { styleText } from 'node:util';
import { program } from '@tscad/commander';
import { execaCommand } from 'execa';
import type { CustomActionConfig } from 'node-plop';
import whichPmRuns from 'which-pm-runs';
import { description, name as packageName, version } from '../package.json';

const pm = whichPmRuns();

const pmCommands = {
  pnpm: {
    create: `pnpm create @tscad`,
    install: 'pnpm add -D @tscad/cli@latest @tscad/modeling@latest',
    runDev: 'pnpm dev',
  },
  npm: {
    create: 'npm init tscad',
    install: 'npm install --save-dev @tscad/cli@latest @tscad/modeling@latest',
    runDev: 'npm run dev',
  },
  cnpm: {
    create: 'cnpm init tscad',
    install: 'cnpm install --save-dev @tscad/cli@latest @tscad/modeling@latest',
    runDev: 'cnpm run dev',
  },
  yarn: {
    create: 'yarn create @tscad',
    install: 'yarn add -D @tscad/cli@latest @tscad/modeling@latest',
    runDev: 'yarn dev',
  },
};

const selectedPm = pm && pm?.name in pmCommands ? (pm.name as keyof typeof pmCommands) : 'npm';
const selectedPmCommands = pmCommands[selectedPm];

const stringifyJsonSource = (source: unknown) => `${JSON.stringify(source, undefined, 2)}\n`;

// Add general usage info
program
  .name(selectedPmCommands.create ?? packageName)
  .option('--force', 'overwrite existing files')
  .version(version)
  .description(description)

  // Add action
  .action(async (options) => {
    console.log(`Running ${packageName}...`);
    const { default: nodePlop } = await import('node-plop');
    const plop = await nodePlop();

    plop.setActionType('run', async (answers, config) => {
      const { stdout } = await execaCommand(config.command, {
        cwd: (answers as { dir: string }).dir,
      });

      return `${config.command}: ${stdout}`;
    });

    const generator = plop.setGenerator(packageName, {
      description,
      prompts: [
        {
          type: 'input',
          name: 'dir',
          message: 'Where to initialize the new project?',
          default: '.',
        },
        {
          type: 'input',
          name: 'projectName',
          message: 'What is the name of your project?',
          default: (answers: { dir: string }) =>
            answers.dir === '.' ? 'my-tscad-project' : path.basename(answers.dir),
        },
      ],
      actions: [
        'Creating project files...',
        {
          type: 'add',
          path: `{{dir}}/package.json`,
          template: stringifyJsonSource({
            name: `{{projectName}}`,
            private: true,
            scripts: {
              dev: 'tscad dev',
            },
            ...(pm ? { packageManager: `${pm.name}@${pm.version}` } : {}),
          }),
          force: options.force,
        },
        {
          type: 'add',
          path: `{{dir}}/.vscode/extensions.json`,
          template: stringifyJsonSource({
            recommendations: ['tscad.tscad-vscode'],
          }),
          force: options.force,
          skipIfExists: true,
        },
        {
          type: 'add',
          path: `{{dir}}/src/model.ts`,
          template: `import { cube, sphere } from '@tscad/modeling/primitives';


export default [
  cube({ size: 1.5, center: [0, 0.75, 0] }),
  sphere({ radius: 1.2, center: [0, 1.2, 0] }),
];
`,
          force: options.force,
        },
        `Installing dependencies using ${selectedPm}`,
        {
          type: 'run',
          command: selectedPmCommands.install,
        } as CustomActionConfig<'run'>,
      ],
    });

    const answers = await generator.runPrompts();

    console.log('');
    const { failures } = await generator.runActions(answers, {
      onComment: (message) => {
        console.log(message);
      },
      onSuccess: (result) => {
        console.log(`👍 ${styleText([], result.type)} ${styleText(['magenta'], result.path)}`);
      },
      onFailure: (error) => {
        if (error.error !== 'Aborted due to previous action failure')
          console.error(`❌ ${error.type}`.trim(), error.error);
      },
    });

    if (failures.length > 0) {
      console.log(`Retry with '--force' to overwrite existing files`);
      process.exitCode = 1;
    } else {
      console.log(`\n🎉 Project created successfully!\nNow, starting the development server...`);
      await execaCommand(selectedPmCommands.runDev, { stdio: 'inherit', cwd: answers.dir });
    }
  })

  // Finally, run the CLI
  .parse();
