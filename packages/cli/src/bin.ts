#!/usr/bin/env node

import { styleText } from 'node:util';
import { homepage, version, description } from '../package.json';
import { program } from 'commander';
import { devCommand } from './commands/dev';

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

  .addCommand(devCommand)

  .parse();
