import { program } from '@tscad/commander';
import { devCommand as developmentCommand } from '@/commands/dev';
import { description, version } from '../package.json';
import { exportCommand } from './commands/export';

// Add general usage info
export const cli = program
  .name('tscad')
  .version(version)
  .description(description)

  // Add commands
  .addCommand(developmentCommand)
  .addCommand(exportCommand);
