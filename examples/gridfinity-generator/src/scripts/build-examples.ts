import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec as _exec } from 'child_process';
import { inspect, promisify } from 'util';

const exec = promisify(_exec);
const prepareDir = (path: string) =>
  rm(path, { recursive: true, force: true }).then(() => mkdir(path, { recursive: true }));

async function buildExamples(args = process.argv.slice(2)) {
  // Cleanup
  if (args.includes('--clean')) {
    await prepareDir('out/examples');
  }

  const { examples } = await import('../examples');

  for (const example of examples) {
    console.log(`Example: ${example.title}`);

    const slug = example.title
      .replace(/[\s()]+/g, ' ')
      .trim()
      .replaceAll(' ', '-')
      .toLowerCase();
    const filename = join('out/examples', `${slug}.js`);

    await writeFile(
      filename,
      `const { gridfinityBaseplate } = require('../');

const main = () => gridfinityBaseplate(${inspect(example.options)});

module.exports = { main };`,
    );

    await exec(`pnpm jscad ./${filename} -o out/examples/${slug}.jscad.json`);
    const command = exec(`pnpm jscad ./${filename} -o out/examples/${slug}.stl`);
    command.child.stdout?.pipe(process.stdout);

    await command;
  }
}

buildExamples()
  .then(() => console.log('Examples built successfully!'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
