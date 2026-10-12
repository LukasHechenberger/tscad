import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { Kernel } from '@tscad/kernel';
import { PluginHost, pluginDependencies, pluginFromOutput } from '@tscad/plugin-host';

/** `tscad.json`: project settings, found next to a model or in a parent folder. */
export type Config = {
  /**
   * Local plugin directories (as built by `tscad-plugin build`), relative to the config file. Plugin
   * packages need no entry: they are found among the model's dependencies.
   */
  plugins?: string[];
};

/** The nearest tscad.json at or above `directory`, with its location. */
export async function findConfig(
  directory: string,
): Promise<{ path: string; config: Config } | undefined> {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    const file = path.join(current, 'tscad.json');
    if (existsSync(file)) return { path: file, config: await Bun.file(file).json() };
    if (path.dirname(current) === current) return undefined;
  }
}

/**
 * A plugin host with the plugins for models in `directory`: the plugin packages among the
 * dependencies of its package.json, and the local plugins listed in the nearest tscad.json.
 */
export async function loadPlugins(kernel: Kernel, directory = '.'): Promise<PluginHost> {
  const host = new PluginHost(kernel);
  const found = await findConfig(directory);
  const sources = [
    ...pluginDependencies(directory).map(({ name, output }) => ({ origin: name, output })),
    ...(found?.config.plugins ?? []).map((entry) => ({
      origin: entry,
      output: path.join(path.dirname(found!.path), entry, 'dist'),
    })),
  ];
  const loaded = new Set<string>();
  for (const { origin, output } of sources) {
    // A plugin package of this workspace may also be listed in tscad.json: load it once.
    const key = existsSync(output) ? realpathSync(output) : output;
    if (loaded.has(key)) continue;
    loaded.add(key);
    await host.add(await pluginFromOutput(output, origin));
  }
  return host;
}
