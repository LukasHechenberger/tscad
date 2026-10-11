/**
 * Runs tscad plugins against a kernel session, in any JS runtime: WebAssembly components
 * transpiled with `jco transpile --instantiation async`. See wit/tscad-plugin.wit.
 */

import type { Kernel, MeshData } from '@tscad/kernel';
import type { Node } from '@tscad/modeling';
import { kernelImports, type HostShape, type KernelImports } from './kernel-imports';

export {
  kernelImports,
  PluginCallError,
  type HostShape,
  type KernelImports,
} from './kernel-imports';

export type PluginKind = 'operation' | 'exporter' | 'analysis';

export type PluginInfo = {
  name: string;
  version: string;
  description: string;
  /** JSON Schema of the plugin's arguments/options, if it has any. */
  optionsSchema?: Record<string, unknown>;
};

/** A transpiled component: jco's `instantiate` plus a way to compile its core modules. */
export type PluginSource = {
  instantiate: (
    getCoreModule: (path: string) => Promise<WebAssembly.Module>,
    imports: object,
  ) => Promise<object>;
  getCoreModule: (path: string) => Promise<WebAssembly.Module>;
  /** Where it came from, for messages. */
  origin?: string;
};

export type LoadedPlugin = {
  kind: PluginKind;
  info: PluginInfo;
  origin?: string;
  fileExtension?: string;
};

type WitMesh = Omit<MeshData, 'edges'>;
type RawInfo = { name: string; version: string; description: string; optionsSchema: string };
type OperationExports = {
  info(): RawInfo;
  evaluate(options: string, children: HostShape[]): HostShape;
};
type ExporterExports = {
  info(): RawInfo;
  fileExtension(): string;
  write(mesh: WitMesh, options: string): Uint8Array;
};
type AnalysisExports = { info(): RawInfo; analyze(model: HostShape, options: string): string };
type AnyExports = Partial<OperationExports & ExporterExports & AnalysisExports> & {
  info(): RawInfo;
};

/** A plugin instance, re-instantiated after it traps (a trapped instance may be corrupt). */
class Instance {
  #exports: Promise<AnyExports>;
  constructor(
    readonly source: PluginSource,
    readonly imports: object,
  ) {
    this.#exports = this.#instantiate();
  }
  #instantiate() {
    return this.source.instantiate(this.source.getCoreModule, this.imports) as Promise<AnyExports>;
  }
  exports() {
    return this.#exports;
  }
  /** Calls into the plugin; maps `err` results and traps to errors naming the plugin. */
  async call<T>(name: string, f: (exports: AnyExports) => T): Promise<T> {
    const exports = await this.#exports;
    try {
      return f(exports);
    } catch (error) {
      if (error instanceof WebAssembly.RuntimeError) {
        this.#exports = this.#instantiate(); // start over with a fresh instance
        throw new Error(`plugin ${name} crashed: ${error.message}`);
      }
      const payload = (error as { payload?: unknown }).payload;
      throw new Error(
        `plugin ${name}: ${payload ?? (error instanceof Error ? error.message : String(error))}`,
      );
    }
  }
}

export class PluginHost {
  readonly #imports: KernelImports;
  readonly #plugins = new Map<string, { loaded: LoadedPlugin; instance: Instance }>();

  constructor(readonly kernel: Kernel) {
    this.#imports = kernelImports(kernel);
  }

  /** Instantiates a plugin and registers it under its `info().name`. */
  async add(source: PluginSource): Promise<LoadedPlugin> {
    // Every plugin gets the full import set; jco's glue looks the names up without the version.
    const imports = { 'tscad:plugin/kernel': this.#imports, 'tscad:plugin/types': {} };
    const instance = new Instance(source, {
      ...imports,
      'tscad:plugin/kernel@0.1.0': this.#imports,
      'tscad:plugin/types@0.1.0': {},
    });
    const exports = await instance.exports();
    const raw = exports.info();
    const kind: PluginKind | undefined = exports.evaluate
      ? 'operation'
      : exports.write
        ? 'exporter'
        : exports.analyze
          ? 'analysis'
          : undefined;
    if (!kind)
      throw new Error(
        `${source.origin ?? raw.name}: not a tscad plugin (exports neither evaluate, write nor analyze)`,
      );
    if (this.#plugins.has(raw.name))
      throw new Error(`plugin ${raw.name} is loaded twice (${source.origin ?? '?'})`);
    const info: PluginInfo = {
      name: raw.name,
      version: raw.version,
      description: raw.description,
      ...(raw.optionsSchema && { optionsSchema: JSON.parse(raw.optionsSchema) }),
    };
    const loaded: LoadedPlugin = {
      kind,
      info,
      origin: source.origin,
      ...(kind === 'exporter' && { fileExtension: exports.fileExtension!().toLowerCase() }),
    };
    this.#plugins.set(raw.name, { loaded, instance });
    return loaded;
  }

  list(): LoadedPlugin[] {
    return [...this.#plugins.values()].map((p) => p.loaded);
  }

  #get(name: string, kind: PluginKind) {
    const plugin = this.#plugins.get(name);
    if (!plugin || plugin.loaded.kind !== kind) {
      const available = this.list()
        .filter((p) => p.kind === kind)
        .map((p) => p.info.name);
      throw new Error(`no ${kind} plugin "${name}" (loaded: ${available.join(', ') || 'none'})`);
    }
    return plugin;
  }

  /** Replaces every `plugin(...)` node by the tree its operation plugin returns (children first). */
  async lower(node: Node): Promise<Node> {
    const raw = node as Node & { children?: Node[]; plugin?: string; args?: unknown };
    const children =
      raw.children && (await Promise.all(raw.children.map((child) => this.lower(child))));
    if (raw.type !== 'plugin')
      return children && children.some((child, index) => child !== raw.children![index])
        ? ({ ...raw, children } as Node)
        : node;
    const { instance } = this.#get(raw.plugin!, 'operation');
    const shapes = (children ?? []).map((child) => new this.#imports.Shape(child));
    const result = await instance.call(raw.plugin!, (plugin) =>
      plugin.evaluate!(JSON.stringify(raw.args ?? {}), shapes),
    );
    return result.node;
  }

  exporterFor(extension: string): LoadedPlugin | undefined {
    return this.list().find(
      (p) => p.kind === 'exporter' && p.fileExtension === extension.toLowerCase(),
    );
  }

  /** Writes a model with the exporter plugin for `extension`. */
  async export(
    model: Node,
    extension: string,
    options: Record<string, unknown> = {},
  ): Promise<Uint8Array> {
    const exporter = this.exporterFor(extension);
    if (!exporter) throw new Error(`no exporter plugin for .${extension}`);
    const lowered = await this.lower(model);
    using shape = this.kernel.evaluate(lowered);
    const { positions, normals, indices, triangleFaces, faceColors } = shape.mesh();
    const { instance } = this.#get(exporter.info.name, 'exporter');
    return instance.call(exporter.info.name, (plugin) =>
      plugin.write!(
        { positions, normals, indices, triangleFaces, faceColors },
        JSON.stringify(options),
      ),
    );
  }

  /** Runs an analysis plugin on a model; returns its report. */
  async analyze(
    model: Node,
    name: string,
    options: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const { instance } = this.#get(name, 'analysis');
    const shape = new this.#imports.Shape(await this.lower(model));
    return JSON.parse(
      await instance.call(name, (plugin) => plugin.analyze!(shape, JSON.stringify(options))),
    );
  }
}
