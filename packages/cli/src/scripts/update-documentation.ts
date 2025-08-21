import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { inspect, styleText } from 'node:util';
import { Template } from '@toolsync/template';
import type { Argument, CommandUnknownOpts, Option } from '@tscad/commander';
import { cli } from '../index';

class RawTemplate extends Template {
  replace(search: RegExp, replacement: string) {
    this.options.content = this.options.content.replace(search, replacement);
  }
}

const getArgumenDescription = (option: Argument | Option) => [
  ...(option.defaultValue ? [`Default: \`${inspect(option.defaultValue)}\``] : []),
  option.description,
];

const getArgumentsDocumentation = (command: CommandUnknownOpts) =>
  command.registeredArguments.flatMap((option) => [
    `### \`${option.name()}\``,
    ...getArgumenDescription(option),
  ]);

const getOptionsDocumentation = (command: CommandUnknownOpts) =>
  command.options.flatMap((option) => [
    `### \`${option.flags}\``,
    ...getArgumenDescription(option),
  ]);

const logPrefix = styleText(['magenta'], 'DOC');
console.time(`${logPrefix} ⚡️ Build succeeded`);
for (const command of cli.commands) {
  const path = `../../apps/docs/content/docs/(cli)/${command.name()}.mdx`;
  console.info(`${logPrefix} Documenting \`${command.name()}\` command...`);

  if (!existsSync(path)) await writeFile(path, '---\n---');

  const template = await RawTemplate.load(path, { commentPattern: { start: `{/*`, end: `*/}` } });
  template.replace(
    /---[^]*---/m,
    `---
title: ${command.name()}
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
      ...(command.registeredArguments.length > 0
        ? [`## Arguments`, ...getArgumentsDocumentation(command)]
        : ['{/* No arguments available. */}']),
    ].join('\n\n'),
    insert: 'bottom',
  });

  template.update({
    section: 'options',
    content: ['## Options', ...getOptionsDocumentation(command)].join('\n\n'),
    insert: 'bottom',
  });

  await template.save();
}
console.timeEnd(`${logPrefix} ⚡️ Build succeeded`);
