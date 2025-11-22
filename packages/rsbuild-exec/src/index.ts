/**
 * Runs a command after the rsbuild build is finished.
 *
 * @remarks
 *
 * This package is not only relevant for tscad, it can be used in every rsbuild/rslib project.
 *
 * @packageDocumentation
 */

import type { RsbuildPlugin } from '@rsbuild/core';
import { execaCommand, type ExecaError, type Options } from 'execa';

/**
 * An rsbuild plugin to execute a command after the build is finished.
 *
 * @param options - The plugin options
 * @returns An rsbuild plugin
 *
 * @example Basic usage
 *
 * ```ts
 * import { pluginRsbuildExec } from 'rsbuild-exec';
 *
 * export default defineConfig({
 *   plugins: [
 *     pluginRsbuildExec({
 *       // An (optional) title for the command (for logging purposes)
 *       title: 'my-command',
 *       // The command to execute
 *       command: 'echo "Hello, World!"',
 *       // (optional) Exec options
 *       options: {
 *         // (just an example)
 *         env: { CUSTOM_ENV_VAR: 'value' },
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function pluginExec(options: {
  /** The command to execute */
  command: string;
  /** Use a custom title for your script, defaults to the command */
  title?: string;
  options?: Options;
}): RsbuildPlugin {
  const { command, title = command, options: execOptions } = options;

  return {
    name: 'rsbuild-exec',
    setup(api) {
      api.onAfterBuild(async () => {
        const start = performance.now();
        api.logger.start(`${title} started...`);

        try {
          await execaCommand(command, {
            ...(execOptions?.stdio ? {} : { stdout: 'inherit', stderr: 'inherit' }),
            ...execOptions,
          });

          api.logger.ready(
            `${title} finished in ${((performance.now() - start) / 1000).toFixed(2)} s`,
          );
        } catch (error) {
          api.logger.error(`${title} failed.`);
          api.logger.error(error);
          process.exitCode = (error as ExecaError).exitCode ?? 1;
        }
      });
    },
  } satisfies RsbuildPlugin;
}

export { pluginExec as pluginRsbuildExec };
