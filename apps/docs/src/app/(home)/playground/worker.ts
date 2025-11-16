import type { Model, ParametersInput, RenderedModel } from '@tscad/modeling';

let model: Model<ParametersInput, Record<string, unknown>>;

type ResponsePayload<R> = {
  result?: R;
  error?: { message: string; stack?: string };
};

export type PreparedModel = {
  token: number;
  // schema: unknown;
  parametersSchema: ParametersInput;
  defaultParameters?: unknown;
};

export type PreparedModelResponse = {
  type: 'prepared';
} & ResponsePayload<PreparedModel>;

export type RenderedModelResponse = {
  type: 'rendered';
} & ResponsePayload<{ model: RenderedModel<unknown> }>;

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

// eslint-disable-next-line unicorn/prefer-add-event-listener
globalThis.onmessage = async (event: MessageEvent<PrepareMessage | RenderMessage>) => {
  console.log('Worker received message', event);
  if (event.data.type === 'render') {
    // FIXME: Check token matches currentToken
    if (event.data.token !== currentToken) {
      console.warn(
        `Received build request for token ${event.data.token}, but current token is ${currentToken}`,
      );
      return;
    }

    try {
      const result = model.render(event.data.parameters as Partial<unknown>);
      self.postMessage({ type: 'rendered', result, error: undefined });
    } catch (error) {
      self.postMessage({
        type: 'rendered',
        error: { message: (error as Error).message, stack: (error as Error).stack },
      });
    }
    return;
  }

  if (event.data.type !== 'prepare') {
    console.error('Unknown message type:', event.data);
    return;
  }

  const { code } = event.data;

  try {
    // Build the function with injected API
    const loadModule = new Function(`${code}\n//# sourceURL=user-script.js`);

    const exports = loadModule();
    console.log({ code, exports });

    if (!exports || (exports.main === undefined && exports.default === undefined)) {
      throw new TypeError('No main or default export found in the module');
    }

    currentToken += 1;
    model = exports.default ?? exports.main;

    console.log('Model prepared', { model, pS: model.parametersSchema });

    self.postMessage({
      type: 'prepared',
      result: {
        token: currentToken,
        // schema: model.schema,
        parametersSchema: model.parametersSchema,
        defaultParameters: model.resolveParameters({}, false),
      } as PreparedModel,
    } satisfies PreparedModelResponse);
  } catch (error) {
    const error_ = error as Error;

    console.error(error);
    self.postMessage({ type: 'prepared', error: { message: error_.message, stack: error_.stack } });
  }
};

// Stop nextjs from nagging about CommonJS syntax...
export {};
