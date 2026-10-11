import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel } from '@tscad/kernel';
import type { EvalResult, Node } from '@tscad/modeling';
import type { ClientMessage, ServerMessage } from '@tscad/viewer/protocol';
import type { Reports } from '@tscad/viewer/report';
import { detectEditor } from './editor';
import { rootDebug } from './log';
import { loadPlugins } from './plugins';

const debug = rootDebug.extend('preview');

/** The model evaluation script, next to this module both in the sources and in the build. */
const here = path.dirname(fileURLToPath(import.meta.url));
const evalScript = ['eval-model.ts', 'eval-model.js', '../eval-model.ts']
  .map((file) => path.join(here, file))
  .find((file) => existsSync(file))!;
/** The viewer page, bundled by scripts/build-preview.ts. */
const previewDirectory = ['preview', '../../out/preview']
  .map((directory) => path.join(here, directory))
  .find((directory) => existsSync(directory));

export type PreviewOptions = {
  port: number;
  /** Initial parameter values; the viewer's form changes them afterwards. */
  values?: Record<string, unknown>;
  log: (message: string) => void;
};

/**
 * Serves the viewer for `modelPath`. Re-renders whenever files next to the model change or a
 * viewer tab changes a parameter; all tabs share one set of parameter values. Resolves with the
 * server once the first render is done.
 */
export async function startPreview(
  modelPath: string,
  { port, values: initialValues = {}, log }: PreviewOptions,
) {
  if (!previewDirectory)
    throw new Error('The preview page is not built; run `bun run build` in packages/cli');
  const model = path.resolve(modelPath);
  const name = path.basename(model);
  const kernel = await loadKernel();
  const plugins = await loadPlugins(kernel, path.dirname(model));
  const editor = detectEditor();

  let values = initialValues;
  let glb: Uint8Array<ArrayBuffer> | undefined;
  let version = 0;
  // Replayed to newly opened tabs: parameters, the last good model, then the current error (if any).
  let lastParameters: ServerMessage | undefined;
  let lastAnalysis: ServerMessage | undefined;
  let lastModel: ServerMessage | undefined;
  let lastError: ServerMessage | undefined;

  const server = Bun.serve({
    port,
    routes: {
      '/': () => new Response(Bun.file(path.join(previewDirectory!, 'index.html'))),
      '/model.glb': () =>
        glb
          ? new Response(glb, {
              headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'no-store' },
            })
          : new Response('no model yet', { status: 503 }),
    },
    async fetch(request, server) {
      const { pathname } = new URL(request.url);
      if (pathname === '/ws' && server.upgrade(request)) return;
      const file = Bun.file(path.join(previewDirectory!, path.normalize(pathname)));
      if (!pathname.includes('..') && (await file.exists())) return new Response(file);
      return new Response('not found', { status: 404 });
    },
    websocket: {
      open(socket) {
        socket.subscribe('model');
        for (const message of [lastParameters, lastModel, lastAnalysis, lastError])
          if (message) socket.send(JSON.stringify(message));
      },
      message(_socket, data) {
        const message = JSON.parse(String(data)) as ClientMessage;
        if (message.type === 'params') {
          values = message.values;
          schedule(0);
        }
      },
    },
  });

  const publish = (message: ServerMessage) => {
    switch (message.type) {
      case 'model': {
        [lastModel, lastError] = [message, undefined];
        break;
      }
      case 'error': {
        lastError = message;
        break;
      }
      case 'analysis': {
        lastAnalysis = message;
        break;
      }
      default: {
        lastParameters = message;
      }
    }
    server.publish('model', JSON.stringify(message));
  };

  async function rebuild() {
    const started = performance.now();
    const child = Bun.spawn([process.execPath, evalScript, model, JSON.stringify(values)], {
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, BUN_BE_BUN: '1' }, // lets a compiled `tscad` binary act as `bun`
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (exitCode !== 0) return fail(stderr.trim() || `model exited with code ${exitCode}`);

    const result = JSON.parse(stdout) as EvalResult;
    if (result.parameters) publish({ type: 'parameters', ...result.parameters });
    if (result.error !== undefined) return fail(result.error);
    try {
      const renderStarted = performance.now();
      // Parsed from the eval process's JSON: a plain tree, not a Shape instance.
      const tree = await plugins.lower(result.tree as unknown as Node);
      glb = kernel.render(tree, 'glb');
      const renderMs = Math.round(performance.now() - renderStarted);
      publish({
        type: 'model',
        version: ++version,
        name,
        file: model,
        editor,
        backend: kernel.backend,
        renderMs,
      });
      log(
        `${name}: rendered in ${renderMs} ms (${Math.round(performance.now() - started)} ms total)`,
      );
      publish({ type: 'analysis', reports: await analyze(tree) });
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
    }
  }

  /** Every analysis plugin's report on `tree`; a failing plugin reports its error. */
  async function analyze(tree: Node): Promise<Reports> {
    const reports: Reports = {};
    for (const { info } of plugins.list().filter((plugin) => plugin.kind === 'analysis')) {
      reports[info.name] = await plugins
        .analyze(tree, info.name)
        .catch((error: Error) => ({ error: error.message }));
    }
    return reports;
  }

  function fail(message: string) {
    publish({ type: 'error', message, editor });
    log(`${name}: ${message}`);
  }

  // One rebuild at a time; requests arriving meanwhile collapse into a single follow-up run
  // with the latest files and values (e.g. while a slider is dragged).
  let running = false;
  let queued = false;
  let timer: Timer | undefined;
  function schedule(delay: number) {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (running) return void (queued = true);
      running = true;
      await rebuild();
      running = false;
      if (queued) {
        queued = false;
        schedule(0);
      }
    }, delay);
  }

  watch(path.dirname(model), { recursive: true }, (_event, file) => {
    // Debounced: editors often write several times per save.
    if (file && /\.(m?[jt]s|json)$/.test(file) && !file.includes('node_modules')) {
      debug('changed', file);
      schedule(50);
    }
  });
  await rebuild();

  return { server, editor };
}
