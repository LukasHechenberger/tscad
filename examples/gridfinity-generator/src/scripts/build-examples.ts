import { exec as _exec } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { inspect, promisify } from 'node:util';
import { magenta } from 'picocolors';

const exec = promisify(_exec);
const prepareDirectory = (path: string) =>
  rm(path, { recursive: true, force: true }).then(() => mkdir(path, { recursive: true }));

async function buildExamples(flags = process.argv.slice(2)) {
  // Cleanup
  if (flags.includes('--clean')) {
    await prepareDirectory('out/examples');
  }

  const { examples } = await import('../examples');

  for (const example of examples) {
    const timeLabel = `${magenta('EXP')} ${example.title}`;
    console.time(timeLabel);

    const slug = example.title
      .replaceAll(/[\s()]+/g, ' ')
      .trim()
      .replaceAll(' ', '-')
      .toLowerCase();
    const filename = path.join('out/examples', `${slug}.js`);

    await writeFile(
      filename,
      `const { gridfinityBaseplate } = require('../');

const main = () => gridfinityBaseplate(${inspect(example.options)});

module.exports = { main };`,
    );

    await exec(`pnpm jscad ./${filename} -o out/examples/${slug}.jscad.json`);
    const command = exec(`pnpm jscad ./${filename} -o out/examples/${slug}.stl`);
    // command.child.stdout?.pipe(process.stdout);

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
