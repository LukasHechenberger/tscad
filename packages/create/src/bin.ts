#!/usr/bin/env node

import { program } from '@tscad/commander';
import whichPmRuns from 'which-pm-runs';
import { description, name as packageName, version } from '../package.json';

const pm = whichPmRuns();

const namePerPm = {
  pnpm: `pnpm create @tscad`,
  npm: 'npm init tscad',
  cnpm: 'cnpm init tscad',
  yarn: 'yarn create @tscad',
};

// Add general usage info
program
  .name((pm && namePerPm[pm.name as keyof typeof namePerPm]) ?? packageName)
  .version(version)
  .description(description)

  // Add action
  .action(() => {
    console.log('Initializing...');
  })

  // Finally, run the CLI
  .parse();
