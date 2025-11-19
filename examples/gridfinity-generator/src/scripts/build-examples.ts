/* eslint-disable no-console */
import { exec as _exec } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspect, promisify } from 'node:util';
import { magenta } from 'picocolors';

const exec = promisify(_exec);
const prepareDirectory = (path: string) => rm(path, { recursive: true, force: true });

async function buildExamples(flags = process.argv.slice(2)) {
  const mode = flags.find((flag) => !flag.startsWith('-')) ?? 'production';
  const { examples } = await import('../examples');

  if (mode === 'development') {
    console.log('Development mode - limiting to first example');
    examples.splice(1);
  }

  // Cleanup
  await prepareDirectory('out/examples');
  await mkdir('out/examples', { recursive: true });

  for (const example of examples) {
    const timeLabel = `${magenta('EXP')} ${example.title}`;
    console.time(timeLabel);

    const slug = example.title
      .replaceAll(/[\s()]+/g, ' ')
      .trim()
      .replaceAll(' ', '-')
      .toLowerCase();
    const filename = path.join('out/examples', `${slug}.mjs`);

    await writeFile(
      filename,
      `import { defineModel } from '@tscad/modeling'; 
import { gridfinityBaseplate } from '../index.js';

export default defineModel({
  model() {
    return gridfinityBaseplate(${inspect(example.options)})
  }
});
`,
    );

    // await exec(`pnpm jscad ./${filename} -o out/examples/${slug}.jscad.json`);
    const command = exec(
      `pnpm tscad export --model ./${filename} --output out/examples/${slug}.stl`,
    );

    await command;

    console.timeEnd(timeLabel);
  }
}

buildExamples()
  // eslint-disable-next-line unicorn/prefer-top-level-await -- because we build cjs as well
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
