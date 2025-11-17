import type { RsbuildPlugin } from '@rsbuild/core';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

export function pluginExec({
  command,
  title = 'script',
}: {
  /** The command to execute */
  command: string;
  /** Use a custom title for your script */
  title?: string;
}): RsbuildPlugin {
  return {
    name: 'rsbuild-exec',
    setup(api) {
      api.onAfterEnvironmentCompile(async () => {
        const start = performance.now();
        api.logger.start(`${title} started...`);

        try {
          const { stdout, stderr } = await exec(command);

          if (stdout) api.logger.info(stdout);
          if (stderr) api.logger.warn(stderr);
          api.logger.ready(
            `${title} finished in ${((performance.now() - start) / 1000).toFixed(2)} s`,
          );
        } catch (error) {
          api.logger.error(`${title} failed.`);
          api.logger.error(error);
        }
      });
    },
  } satisfies RsbuildPlugin;
}

export { pluginExec as pluginRsbuildExec };
