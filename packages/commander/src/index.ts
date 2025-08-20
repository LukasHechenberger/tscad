import { styleText } from 'node:util';
import { program as defaultProgram } from 'commander';
import { homepage } from '../package.json';

export * from 'commander';

// Add general usage info
export const program = defaultProgram
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
  });
