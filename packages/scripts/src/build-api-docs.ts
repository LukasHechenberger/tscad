#!/usr/bin/env bun
/* eslint-disable no-console -- a build script reporting what it generated */

import { generateApiDocs, MODULES, siteOutput } from './api-docs/mdx';

for (const module of MODULES) {
  const started = performance.now();
  const count = await generateApiDocs(module);
  console.log(
    `api docs: ${module.name}, ${count} entries → ${siteOutput(module).contentDir} (${Math.round(performance.now() - started)} ms)`,
  );
}
