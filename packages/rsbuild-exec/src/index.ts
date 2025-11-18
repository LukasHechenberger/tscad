import type { RsbuildPlugin } from '@rsbuild/core';
import { execaCommand, type ExecaError, type Options } from 'execa';

/**
 * @remarks
 *
 * This package is not only relevant for tscad, it can be used in every rsbuild/rslib project.
 *
 * @packageDocumentation
 */

/**
 * An rsbuild plugin to execute a command after the build is finished.
 *
 * @param pluginOptions - The plugin options
 * @returns An rsbuild plugin
 *
 *
 * @example Basic Usage
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
export function pluginExec(pluginOptions: {
  /** The command to execute */
  command: string;
  /** Use a custom title for your script */
  title?: string;
  options?: Options;
}): RsbuildPlugin {
  const { command, title = 'script', options } = pluginOptions;

  return {
    name: 'rsbuild-exec',
    setup(api) {
      api.onAfterEnvironmentCompile(async () => {
        const start = performance.now();
        api.logger.start(`${title} started...`);

        try {
          await execaCommand(command, {
            ...(options?.stdio ? {} : { stdout: 'inherit', stderr: 'inherit' }),
            ...options,
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
