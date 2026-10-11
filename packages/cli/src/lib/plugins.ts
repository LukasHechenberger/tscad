import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Kernel } from '@tscad/kernel';
import { PluginHost, pluginFromDirectory } from '@tscad/plugin-host';

/** `tscad.json`: project settings, found next to a model or in a parent folder. */
export type Config = {
  /** Plugin directories (as built by `@tscad/plugins`), relative to the config file. */
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

/** A plugin host with the plugins listed in the tscad.json nearest to `directory`. */
export async function loadPlugins(kernel: Kernel, directory = '.'): Promise<PluginHost> {
  const host = new PluginHost(kernel);
  const found = await findConfig(directory);
  for (const entry of found?.config.plugins ?? []) {
    await host.add(await pluginFromDirectory(path.join(path.dirname(found!.path), entry)));
  }
  return host;
}
