#!/usr/bin/env bun
/* eslint-disable no-console -- a build script reporting what it generated */

import { generateApiDocs, SITE } from './api-docs/mdx';

const started = performance.now();
const count = await generateApiDocs();
console.log(
  `api docs: ${count} entries → ${SITE.contentDir} (${Math.round(performance.now() - started)} ms)`,
);
