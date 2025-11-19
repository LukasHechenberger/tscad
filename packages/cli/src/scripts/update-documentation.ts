/* eslint-disable no-console */
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { styleText } from 'node:util';
import { MarkdownTemplate, Template } from '@toolsync/template';
import type { Command } from '@tscad/commander';
import { cli } from '../index';

// NOTE: This script does not handle subcommands of subcommands

class RawTemplate extends Template {
  replace(search: RegExp, replacement: string) {
    this.options.content = this.options.content.replace(search, replacement);
  }
}

const getArgumentsDocumentation = (command: Command) =>
  `{/* prettier-ignore */}
<TypeTable type={${JSON.stringify(
    Object.fromEntries(
      command.registeredArguments.map((argument) => [
        argument.name(),
        {
          type: 'string',
          required: argument.required,
          description: argument.description,
          default: argument.defaultValue,
        },
      ]),
    ),
    undefined,
    2,
  )}} />`;

const getOptionsDocumentation = (command: Command) =>
  `{/* prettier-ignore */}
<TypeTable type={${JSON.stringify(
    Object.fromEntries(
      command.options.map((argument) => [
        `--${argument.name()}`,
        {
          type: typeof argument.defaultValue,
          required: argument.required,
          description: argument.description,
          default: argument.defaultValue,
        },
      ]),
    ),
    undefined,
    2,
  )}} />`;

const logPrefix = styleText(['magenta'], 'DOC');
console.time(`${logPrefix} ⚡️ Build succeeded`);

// eslint-disable-next-line turbo/no-undeclared-env-vars
delete process.env.FORCE_COLOR;
// eslint-disable-next-line turbo/no-undeclared-env-vars
process.env.NO_COLOR = '1';

await MarkdownTemplate.update('README.md', {
  section: 'usage',
  content: `\`\`\`
${cli.helpInformation({ error: false })}
\`\`\``,
});

// Force color output
// eslint-disable-next-line turbo/no-undeclared-env-vars
delete process.env.NO_COLOR;
// eslint-disable-next-line turbo/no-undeclared-env-vars
process.env.FORCE_COLOR = '1';

for (const command of cli.commands) {
  const path = `../../apps/docs/content/docs/(cli)/${command.name()}.mdx`;
  console.info(`${logPrefix} Documenting \`${command.name()}\` command...`);

  if (!existsSync(path)) await writeFile(path, '---\n---');

  const template = await RawTemplate.load(path, { commentPattern: { start: `{/*`, end: `*/}` } });
  template.replace(
    /---[^]*---/m,
    `---
title: ${cli.name()} ${command.name()}
description: ${command.description()}
---`,
  );

  template.update({
    section: 'usage',
    content: `
    \`\`\`ansi title="Terminal"
${command
  .configureOutput({
    // We don't need line breaks here...
    getOutHelpWidth: () => 1000,
  })
  .helpInformation({ error: false })}
\`\`\`
`,
    insert: 'bottom',
  });

  template.update({
    section: 'arguments',
    content: [
      "import { TypeTable } from 'fumadocs-ui/components/type-table';",
      '## API',
      `\`\`\`ansi title="Terminal"
${
  command
    .helpInformation({ error: false })
    .replace(/.+:/, styleText(['dim'], '$'))
    .split('\n')[0]
}
\`\`\``,
      ...(command.registeredArguments.length > 0
        ? [`### Arguments [!toc]`, getArgumentsDocumentation(command)]
        : ['{/* No arguments available. */}']),
    ].join('\n\n'),
    insert: 'bottom',
  });

  template.update({
    section: 'options',
    content: ['### Options [!toc]', getOptionsDocumentation(command)].join('\n\n'),
    insert: 'bottom',
  });

  await template.save();
}
console.timeEnd(`${logPrefix} ⚡️ Build succeeded`);
