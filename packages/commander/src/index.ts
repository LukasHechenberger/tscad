import { styleText } from 'node:util';
import { Command as DefaultCommand } from 'commander';
import { homepage } from '../package.json';

export * from 'commander';

export class Command extends DefaultCommand {
  constructor(name?: string) {
    super(name);

    // Add colors
    this.configureHelp({
      styleCommandText: (text) => styleText(['bold', 'magenta'], text),
      styleCommandDescription: (text) => styleText(['dim'], `> ${text}`),
      styleTitle: (text) => styleText(['bold'], text),
      styleOptionText: (text) => styleText(['cyan'], text),
      styleArgumentText: (text) => styleText(['cyan'], text),
    });

    this.configureOutput({
      outputError: (string_, write) => {
        write(styleText(['red'], string_));
      },
    });
  }
}

// Add general usage info
export const program = new Command().addHelpText(
  'afterAll',
  `
${styleText(['italic'], 'Documentation:')} ${styleText(['magenta'], homepage)}`,
);
