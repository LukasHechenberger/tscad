/** Bun entry: everything from ./index.ts plus loading plugins from built plugin directories. */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PluginSource } from './index';

export * from './index';

/** A plugin directory as `@tscad/plugins`' build leaves it: `<dir>/dist/plugin.js` + core wasm. */
export async function pluginFromDirectory(directory: string): Promise<PluginSource> {
  const outputDirectory = path.join(path.resolve(directory), 'dist');
  const entry = path.join(outputDirectory, 'plugin.js');
  if (!existsSync(entry))
    throw new Error(
      `plugin ${directory} is not built (no ${entry}); run \`bun run build --filter=@tscad/plugins\``,
    );
  const { instantiate } = await import(entry);
  return {
    instantiate,
    getCoreModule: async (file) =>
      WebAssembly.compile(await Bun.file(path.join(outputDirectory, file)).arrayBuffer()),
    origin: directory,
  };
}
