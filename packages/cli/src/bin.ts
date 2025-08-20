#!/usr/bin/env node

import { program } from '@tscad/commander';
import { devCommand as developmentCommand } from '@/commands/dev';
import { description, version } from '../package.json';

// Add general usage info
program
  .name('tscad')
  .version(version)
  .description(description)

  // Add commands
  .addCommand(developmentCommand)

  // Finally, run the CLI
  .parse();
