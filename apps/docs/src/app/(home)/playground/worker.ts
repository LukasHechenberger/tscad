import { createWasmKernel, type Kernel } from '@tscad/kernel';
import { evaluateModel, Model, type ModelExport, type ParametersJsonSchema } from '@tscad/modeling';
import * as zod from 'zod';

/** Modules the playground provides to user code without bundling them (see `bundleCode`). */
(globalThis as { __tscadPlaygroundModules?: Record<string, unknown> }).__tscadPlaygroundModules = {
  zod,
};

let model: ModelExport;
let kernel: Promise<Kernel> | undefined;

/** The wasm kernel (OpenCASCADE, ~20 MB), loaded once on first use. */
function loadKernel() {
  // Absolute: bundled workers may not resolve root-relative URLs against the page.
  kernel ??= fetch(new URL('/playground/resources/kernel.wasm', self.location.origin))
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to load the kernel: ${response.statusText}`);
      return response.arrayBuffer();
    })
    .then((wasm) => createWasmKernel(wasm));
  return kernel;
}

type ResponsePayload<R> = {
  result?: R;
  error?: { message: string; stack?: string };
};

export type PreparedModel = {
  token: number;
  parametersSchema: ParametersJsonSchema;
  defaultParameters?: Record<string, unknown>;
};

/** A model as the kernel rendered it: GLB for the viewer. */
export type RenderedModel = { glb: ArrayBuffer; renderMs: number };

export type PreparedModelResponse = {
  type: 'prepared';
} & ResponsePayload<PreparedModel>;

export type RenderedModelResponse = {
  type: 'rendered';
} & ResponsePayload<RenderedModel>;

export type WorkerResponse = PreparedModelResponse | RenderedModelResponse;

type PrepareMessage = {
  type: 'prepare';
  code: string;
};

type RenderMessage = {
  type: 'render';
  parameters: unknown;
  token: number;
};

let currentToken = 0;

const errorPayload = (error: unknown) => ({
  message: (error as Error).message,
  stack: (error as Error).stack,
});

globalThis.addEventListener(
  'message',
  async (event: MessageEvent<PrepareMessage | RenderMessage>) => {
    if (event.data.type === 'render') {
      // Check token matches currentToken
      if (event.data.token !== currentToken) {
        // eslint-disable-next-line no-console
        console.warn(
          `Received build request for token ${event.data.token}, but current token is ${currentToken}`,
        );
        return;
      }

      try {
        const result = await evaluateModel(
          model,
          (event.data.parameters ?? {}) as Record<string, unknown>,
        );
        if (result.error !== undefined) throw new Error(result.error);
        const started = performance.now();
        const engine = await loadKernel();
        // A copy owning its buffer, transferred to the page.
        const glb = new Uint8Array(engine.render(result.tree, 'glb')).buffer;
        const renderMs = Math.round(performance.now() - started);
        self.postMessage(
          { type: 'rendered', result: { glb, renderMs } } satisfies RenderedModelResponse,
          {
            transfer: [glb],
          },
        );
      } catch (error) {
        self.postMessage({ type: 'rendered', error: errorPayload(error) });
      }
      return;
    }

    if (event.data.type !== 'prepare') {
      // eslint-disable-next-line no-console
      console.error('Unknown message type:', event.data);
      return;
    }

    const { code } = event.data;

    try {
      // Build the function with injected API
      const loadModule = new Function(`${code}\n//# sourceURL=user-script.js`);

      const exports = loadModule();

      if (!exports || (exports.main === undefined && exports.default === undefined)) {
        throw new TypeError('No main or default export found in the module');
      }

      currentToken += 1;
      model = exports.default ?? exports.main;

      self.postMessage({
        type: 'prepared',
        result: {
          token: currentToken,
          parametersSchema: model instanceof Model ? model.parametersJsonSchema() : {},
          defaultParameters:
            model instanceof Model
              ? ((await model.resolveParameters({})) as Record<string, unknown>)
              : {},
        },
      } satisfies PreparedModelResponse);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      self.postMessage({ type: 'prepared', error: errorPayload(error) });
    }
  },
);
