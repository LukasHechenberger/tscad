import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';
import { defineConfig, RsbuildPlugin } from '@rslib/core';

const exec = promisify(_exec);

export default defineConfig({
  source: {
    entry: {
      bin: './src/bin.ts',
      'scripts/update-documentation': './src/scripts/update-documentation.ts',
    },
  },
  output: {
    distPath: './out',
    target: 'node',
    sourceMap: true,
  },
  lib: [{ id: 'lib', format: 'esm' }],
  plugins: [
    {
      name: 'api-docs',
      setup(api) {
        api.onAfterEnvironmentCompile(async () => {
          const start = performance.now();

          try {
            await exec('node --enable-source-maps ./out/scripts/update-documentation.js');

            const end = performance.now();
            api.logger.ready(`built in ${((end - start) / 1000).toFixed(2)} s (documentation)`);
          } catch (error) {
            api.logger.error('Failed to update documentation');
            api.logger.error(error);
          }
        });
      },
    } satisfies RsbuildPlugin,
  ],
});
