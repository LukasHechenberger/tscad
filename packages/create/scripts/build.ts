/* eslint-disable no-console */

import { $ } from 'bun';
import manifest from '../package.json' with { type: 'json' };

console.time('Build');
const result = await Bun.build({
  entrypoints: ['./src/bin.ts'],
  outdir: './out',
  target: 'node',
  external: Object.keys(manifest.dependencies),
  format: 'esm',
  metafile: true,
});
console.timeEnd('Build');

if (result.logs.length > 0) {
  console.warn('Build succeeded with warnings:');

  for (const message of result.logs) {
    // Bun will pretty print the message object
    console.warn(message);
  }
}

if (result.metafile) {
  // Analyze outputs
  for (const [path, meta] of Object.entries(result.metafile.outputs)) {
    console.log(`Output ${path}: ${meta.bytes} bytes`);
  }

  // Save for external analysis tools
  await Bun.write('./out/meta.json', JSON.stringify(result.metafile));
}

// Generate readme
console.time('Generate README');
const usage = await $`bun out/bin.js --help`.text();
await $`bun update-section README.md usage "\`\`\`
${usage.trim()}
\`\`\`"`;
console.timeEnd('Generate README');
