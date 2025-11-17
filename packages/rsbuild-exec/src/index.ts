import { stderr, type stdout } from 'node:process';
import type { RsbuildPlugin } from '@rsbuild/core';
import { execaCommand, type Options } from 'execa';

export function pluginExec({
  command,
  title = 'script',
  options,
}: {
  /** The command to execute */
  command: string;
  /** Use a custom title for your script */
  title?: string;
  options?: Options;
}): RsbuildPlugin {
  return {
    name: 'rsbuild-exec',
    setup(api) {
      api.onAfterEnvironmentCompile(async () => {
        const start = performance.now();
        api.logger.start(`${title} started...`);

        try {
          await execaCommand(command, { stdout: 'inherit', stderr: 'inherit', ...options });

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
