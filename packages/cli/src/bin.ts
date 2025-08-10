#!/usr/bin/env node

import { styleText } from 'node:util';
import { program } from 'commander';
import { devCommand as developmentCommand } from '@/commands/dev';
import { description, homepage, version } from '../package.json';

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

  // Add commands
  .addCommand(developmentCommand)

  // Finally, run the CLI
  .parse();
