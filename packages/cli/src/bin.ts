#!/usr/bin/env node

import { styleText } from 'node:util';
import { program } from 'commander';
import { description, homepage, version } from '../package.json';
import { devCommand as developmentCommand } from './commands/dev';

// Add general usage info
program
  .name('tscad')
  .version(version)
  .description(description)
  .addHelpText(
    'afterAll',
    `
${styleText(['italic'], 'For details consult the tscad documentation:')}
  ${styleText(['magenta'], homepage)}`,
  )

  // Add colors
  .configureHelp({
    styleCommandText: (text) => styleText(['bold', 'cyan'], text),
    styleCommandDescription: (text) => styleText(['dim'], text),
    styleTitle: (text) => styleText(['bold'], text),
    styleOptionText: (text) => styleText(['cyan'], text),
    styleArgumentText: (text) => styleText(['cyan'], text),
  })

  .addCommand(developmentCommand)

  .parse();
