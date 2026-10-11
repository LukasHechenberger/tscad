/** Bun entry: everything from ./index.ts plus loading plugins from disk. */
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { PluginSource } from './index';

export * from './index';

/** A plugin directory as `tscad-plugin build` leaves it: `<dir>/dist/plugin.js` + core wasm. */
export async function pluginFromDirectory(directory: string): Promise<PluginSource> {
  return pluginFromOutput(path.join(path.resolve(directory), 'dist'), directory);
}

/** The build output of a plugin: `plugin.js` (jco's transpiled component) + core wasm. */
export async function pluginFromOutput(
  outputDirectory: string,
  origin: string = outputDirectory,
): Promise<PluginSource> {
  const entry = path.join(outputDirectory, 'plugin.js');
  if (!existsSync(entry))
    throw new Error(
      `plugin ${origin} is not built (no ${entry}); run \`tscad-plugin build\` in it`,
    );
  const { instantiate } = await import(entry);
  return {
    instantiate,
    getCoreModule: async (file) =>
      WebAssembly.compile(await Bun.file(path.join(outputDirectory, file)).arrayBuffer()),
    origin,
  };
}

type PackageJson = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  tscad?: { plugin?: string };
};

/** The nearest package.json at or above `directory`. */
function findPackage(directory: string): { directory: string; json: PackageJson } | undefined {
  for (let current = path.resolve(directory); ; current = path.dirname(current)) {
    const file = path.join(current, 'package.json');
    if (existsSync(file))
      return { directory: current, json: JSON.parse(readFileSync(file, 'utf8')) as PackageJson };
    if (path.dirname(current) === current) return undefined;
  }
}

/** Where `name` is installed for a package in `directory`, looking up through node_modules. */
function findInstalled(name: string, directory: string): string | undefined {
  for (let current = directory; ; current = path.dirname(current)) {
    const installed = path.join(current, 'node_modules', name);
    if (existsSync(path.join(installed, 'package.json'))) return realpathSync(installed);
    if (path.dirname(current) === current) return undefined;
  }
}

/**
 * The plugin packages among the dependencies of the package containing `directory`: those with a
 * `"tscad": { "plugin": "./dist" }` field in their package.json, pointing at their build output.
 */
export function pluginDependencies(
  directory: string,
): { name: string; directory: string; output: string }[] {
  const found = findPackage(directory);
  if (!found) return [];
  const { dependencies = {}, devDependencies = {} } = found.json;
  return Object.keys({ ...dependencies, ...devDependencies }).flatMap((name) => {
    const installed = findInstalled(name, found.directory);
    const plugin = installed && findPackage(installed)?.json.tscad?.plugin;
    return plugin ? [{ name, directory: installed, output: path.join(installed, plugin) }] : [];
  });
}
