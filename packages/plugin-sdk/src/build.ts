/**
 * Builds a tscad plugin: the Rust crate in a package directory → core wasm
 * (wasm32-unknown-unknown + wit-bindgen) → component (`jco new`) → JS + core wasm in the package's
 * plugin directory (`"tscad": { "plugin": "./dist" }`, `jco transpile --instantiation async`),
 * loadable by `@tscad/plugin-host` in Bun and browsers.
 *
 * A plugin with options (an `options-schema` in its `info()`, derived from its Rust options struct)
 * also gets them as WIT, `<name>.wit` (see options-wit.ts), and typed exports, `index.js` and
 * `index.d.ts` (see typed-exports.ts). The TypeScript comes from `jco types` on that WIT, which
 * keeps its doc comments.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $ } from 'bun';
import { optionsWit } from './options-wit';
import { optionsType, typedExports } from './typed-exports';

/** The WIT plugins implement: `wit_bindgen::generate!({ world: "operation", path: <this> })`. */
export const WIT_DIRECTORY = path.join(import.meta.dir, '../wit');

/** jco's command line, run with the current runtime. */
const jco = (() => {
  const manifest = fileURLToPath(import.meta.resolve('@bytecodealliance/jco/package.json'));
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { bin: Record<string, string> };
  return [process.execPath, path.join(path.dirname(manifest), bin.jco!)];
})();

type CargoMetadata = {
  target_directory: string;
  packages: { name: string; manifest_path: string; targets: { name: string; kind: string[] }[] }[];
};

type PackageJson = { name?: string; tscad?: { plugin?: string } };

export type BuildResult = {
  /** The plugin's name, from its `info()`. */
  name: string;
  kind: 'operation' | 'exporter' | 'analysis';
  /** Where the transpiled component and the typed exports are. */
  outputDirectory: string;
  /** Size of the component in bytes. */
  componentSize: number;
  /** The typed exports' files, if the plugin has options. */
  typedExports?: { js: string; dts: string; wit: string };
};

function kernelUnavailable(): never {
  throw new Error('the kernel is not available while building plugins');
}

/** Every import of a plugin, failing if called: `info()` needs no kernel. */
function unavailableImports(): object {
  return new Proxy({}, { get: () => new Proxy({}, { get: () => kernelUnavailable }) });
}

/** Builds the plugin package in `directory` (with a Cargo.toml and a package.json). */
export async function buildPlugin(directory: string): Promise<BuildResult> {
  const packageDirectory = path.resolve(directory);
  const manifestPath = path.join(packageDirectory, 'Cargo.toml');
  const packageJson = (await Bun.file(
    path.join(packageDirectory, 'package.json'),
  ).json()) as PackageJson;
  const outputDirectory = path.join(packageDirectory, packageJson.tscad?.plugin ?? './dist');

  const metadata =
    (await $`cargo metadata --format-version 1 --no-deps --manifest-path ${manifestPath}`
      .quiet()
      .json()) as CargoMetadata;
  const crate = metadata.packages.find((candidate) => candidate.manifest_path === manifestPath);
  const library = crate?.targets.find((target) => target.kind.includes('cdylib'));
  if (!crate || !library) throw new Error(`${manifestPath}: no crate with a cdylib target`);

  await $`cargo build --release --target wasm32-unknown-unknown --manifest-path ${manifestPath}`.env(
    {
      ...process.env,
      CARGO_PROFILE_RELEASE_STRIP: 'true',
    },
  );
  const core = path.join(
    metadata.target_directory,
    'wasm32-unknown-unknown/release',
    `${library.name.replaceAll('-', '_')}.wasm`,
  );
  mkdirSync(outputDirectory, { recursive: true }); // jco does not create it
  const component = path.join(outputDirectory, 'plugin.component.wasm');
  await $`${jco} new ${core} -o ${component}`.quiet();
  await $`${jco} transpile ${component} -o ${outputDirectory} --name plugin --instantiation async --no-nodejs-compat -q`.quiet();

  const { instantiate } = await import(path.join(outputDirectory, 'plugin.js'));
  const exports = await instantiate(
    async (file: string) =>
      WebAssembly.compile(await Bun.file(path.join(outputDirectory, file)).arrayBuffer()),
    unavailableImports(),
  );
  const info = exports.info() as { name: string; optionsSchema: string };
  const kind = exports.evaluate ? 'operation' : exports.write ? 'exporter' : 'analysis';
  const result: BuildResult = {
    name: info.name,
    kind,
    outputDirectory,
    componentSize: Bun.file(component).size,
  };
  for (const file of ['index.js', 'index.d.ts', `${info.name}.wit`])
    rmSync(path.join(outputDirectory, file), { force: true });
  if (!info.optionsSchema) return result;

  const wit = path.join(outputDirectory, `${info.name}.wit`);
  await Bun.write(wit, optionsWit(info.name, JSON.parse(info.optionsSchema)));
  const types = mkdtempSync(path.join(tmpdir(), `tscad-plugin-${info.name}-`));
  try {
    await $`${jco} types ${wit} --world-name ${info.name} -o ${types} -q`.quiet();
    const declarations = await Bun.file(
      path.join(types, 'interfaces', `tscad-${info.name}-options.d.ts`),
    ).text();
    if (!declarations.includes(`export interface ${optionsType(info.name)} `))
      throw new Error(`jco types did not declare ${optionsType(info.name)}`);
    const { js, dts } = typedExports({
      plugin: info.name,
      packageName: packageJson.name ?? info.name,
      isOperation: kind === 'operation',
      declarations,
    });
    await Bun.write(path.join(outputDirectory, 'index.js'), js);
    await Bun.write(path.join(outputDirectory, 'index.d.ts'), dts);
    result.typedExports = {
      js: path.join(outputDirectory, 'index.js'),
      dts: path.join(outputDirectory, 'index.d.ts'),
      wit,
    };
  } finally {
    rmSync(types, { recursive: true, force: true });
  }
  return result;
}
