#!/usr/bin/env bun
/* eslint-disable no-console -- a command line tool reporting what it built */
import path from 'node:path';
import { buildPlugin } from './build';

const usage = `Usage: tscad-plugin build [directory]

Builds the tscad plugin in directory (default: the current one): its Rust crate (Cargo.toml) into
a WebAssembly component, transpiled for @tscad/plugin-host into the package's plugin directory
("tscad": { "plugin": "./dist" } in package.json), plus typed exports for its options.`;

const [command, directory = '.', ...rest] = process.argv.slice(2);
if (command === '--help' || command === '-h') {
  console.log(usage);
} else if (command !== 'build' || rest.length > 0) {
  console.error(usage);
  process.exitCode = 1;
} else {
  try {
    const result = await buildPlugin(directory);
    const output = path.relative(process.cwd(), result.outputDirectory) || '.';
    console.log(
      `${result.name} (${result.kind}): ${(result.componentSize / 1024).toFixed(0)} KiB component → ${output}${result.typedExports ? ', with typed exports' : ''}`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
