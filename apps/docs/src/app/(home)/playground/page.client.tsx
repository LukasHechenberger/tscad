'use client';

import { observable } from '@legendapp/state';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { use$ } from '@legendapp/state/react';
import { syncObservable } from '@legendapp/state/sync';
import Editor, { type Monaco, type OnMount, useMonaco } from '@monaco-editor/react';
import type { RenderedModel } from '@tscad/modeling';
import { jsonSchemaToLevaSchema, RenderedSolids, ViewerCanvas } from '@tscad/viewer/src/viewer';
import type * as esbuild from 'esbuild-wasm';
import { button, Leva, useControls } from 'leva';
import { useTheme } from 'next-themes';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { bundleCode } from '@/lib/esbuild';
import { defaultCode } from '@/lib/playground';
import { homepage } from '../../../../package.json';
import type { PreparedModel, WorkerResponse } from './worker';

const documentationOrigin = new URL(homepage).host;

let worker: Worker;

class WorkerError extends Error {
  constructor(
    message: string,
    public stack?: string,
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

async function prepareModelInWorker(tsCode: string) {
  worker ??= new Worker(new URL('worker.ts', import.meta.url), { type: 'module' });

  let jsCode: string;

  const result = await bundleCode(tsCode);
  if (result.text) jsCode = result.text;
  else throw result;

  return new Promise<PreparedModel>((resolve, reject) => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type !== 'prepared') {
        reject(new Error(`Unexpected response type: ${data.type}`));
        return;
      }

      const { result, error } = data as { error?: Error; result?: PreparedModel };

      if (result) resolve(result);
      else if (error) {
        const remoteError = new WorkerError(error.message, error.stack);

        reject(remoteError);
      } else {
        reject(new Error(`Unexpected response: ${JSON.stringify(data)}`));
      }
    };
    worker.postMessage({ type: 'prepare', code: jsCode });
  });
}

async function renderModelInWorker({
  model,
  parameters,
}: {
  model: PreparedModel;
  parameters: unknown;
}) {
  worker ??= new Worker(new URL('worker.ts', import.meta.url), { type: 'module' });

  return new Promise<RenderedModel<unknown>>((resolve, reject) => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type !== 'rendered') {
        reject(new Error(`Unexpected response type: ${data.type}`));
        return;
      }
      const { result, error } = data as { error?: Error; result?: RenderedModel<unknown> };

      if (result) resolve(result);
      else if (error) {
        const remoteError = new WorkerError(error.message, error.stack);

        reject(remoteError);
      } else {
        reject(new Error(`Unexpected response: ${JSON.stringify(data)}`));
      }
    };
    worker.postMessage({ type: 'render', token: model.token, parameters });
  });
}

type PlaygroundContextType = {
  code: string;
  setCode: (code: string) => void;
  preparedModel?: PreparedModel;
  renderedModel?: RenderedModel<unknown>;
  setParameters: (parameters: unknown) => void;
  building: boolean;
  error?: Error;
};

const PlaygroundContext = createContext<PlaygroundContextType>(
  undefined as unknown as PlaygroundContextType,
);

const code$ = observable(defaultCode);
syncObservable(code$, {
  persist: {
    name: 'playground.code',
    plugin: ObservablePersistLocalStorage,
  },
});

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  // The parameters, as set by the user
  const code = use$(code$);
  const [debouncedCode, setDebouncedCode] = useState(code);

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [preparedModel, setPreparedModel] = useState<PreparedModel | undefined>();

  const [inputParameters, setInputParameters] = useState<unknown>({});
  const [debouncedParameters, setDebouncedParameters] = useState<unknown>({});
  const [renderedModel, setRenderedModel] = useState<RenderedModel<unknown> | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCode(code), 50);
    return () => clearTimeout(timer);
  }, [code]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedParameters(inputParameters), 50);
    return () => clearTimeout(timer);
  }, [inputParameters]);

  // Prepare the model when the code changes
  useEffect(() => {
    setBuilding(true);
    setError(undefined);

    let outdated = false;
    const prepareModel = async () => {
      try {
        const result = await prepareModelInWorker(debouncedCode);
        if (outdated) {
          // eslint-disable-next-line no-console
          console.debug('Skipping state update, component is outdated');
        } else {
          setPreparedModel(result);
        }
      } catch (error) {
        if (!outdated) {
          setError(error as Error);
          setBuilding(false);
          setPreparedModel(undefined);
        }
      }
    };

    prepareModel();

    return () => {
      outdated = true; // Mark as outdated to prevent state updates after unmount
    };
  }, [debouncedCode]);

  // Build the model when the prepared model or parameters change
  useEffect(() => {
    if (!preparedModel) return;

    setBuilding(true);
    setError(undefined);

    let outdated = false;
    const buildModel = async () => {
      // eslint-disable-next-line no-console
      console.debug('Building model in worker with parameters', debouncedParameters);

      try {
        const result = await renderModelInWorker({
          model: preparedModel,
          parameters: debouncedParameters,
        });
        if (outdated) {
          // eslint-disable-next-line no-console
          console.debug('Skipping state update, component is outdated');
        } else {
          setRenderedModel(result);
          setBuilding(false);
        }
      } catch (error) {
        if (!outdated) {
          setError(error as Error);
          setBuilding(false);
        }
      }
    };

    buildModel();

    return () => {
      outdated = true; // Mark as outdated to prevent state updates after unmount
    };
  }, [preparedModel, debouncedParameters]);

  return (
    <PlaygroundContext.Provider
      value={{
        code,
        setCode: code$.set,
        preparedModel,
        setParameters: setInputParameters,
        renderedModel,
        building,
        error,
      }}
    >
      {children}
    </PlaygroundContext.Provider>
  );
}

const defaultSettings = {
  gridEnabled: true,
};

const settings$ = observable(defaultSettings);

// Persist the observable to the named key of the global persist plugin
syncObservable(settings$, {
  persist: {
    name: 'playground.settings',
    plugin: ObservablePersistLocalStorage,
  },
});

export function PlaygroundPreview() {
  const viewOptions = use$(settings$);
  const { renderedModel, preparedModel, building, setParameters } = useContext(PlaygroundContext);

  const appliedViewOptions = useControls('View Options', {
    gridEnabled: {
      value: viewOptions.gridEnabled ?? defaultSettings.gridEnabled,
      label: 'Show Grid',
    },
  }) as typeof defaultSettings;

  useEffect(() => settings$.set(appliedViewOptions), [appliedViewOptions]);

  const parameters = useControls(
    'Model Parameters',
    {
      ...(preparedModel
        ? jsonSchemaToLevaSchema(
            preparedModel.parametersSchema,
            (preparedModel?.defaultParameters ?? {}) as Record<string, unknown>,
          )
        : {}),
      // reset parameters button
      reset: button(() => {
        setParameters(preparedModel?.defaultParameters ?? {});
      }),
    },
    [preparedModel],
  );

  useEffect(() => setParameters(parameters), [parameters, setParameters]);

  return (
    <>
      <div className="absolute top-4 right-4 z-1 w-[300px]">
        <Leva
          titleBar={{ title: 'Options' }}
          fill
          hideCopyButton
          theme={{
            colors: {
              elevation1: 'var(--card)',
              elevation2: 'var(--muted)',
              folderTextColor: 'var(--card-foreground)',
              highlight1: 'var(--card-foreground)',
              highlight2: 'var(--muted-foreground)',
              highlight3: 'var(--foreground)',
            },
            radii: {
              xs: 'var(--radius-sm)',
              sm: 'var(--radius-sm)',
              lg: 'var(--radius-md)',
            },
          }}
        />
      </div>

      <ViewerCanvas
        style={{
          transition: 'opacity 0.1s ease-in-out',
          opacity: building ? 0.5 : 1,
        }}
        grid={appliedViewOptions.gridEnabled}
      >
        {renderedModel && <RenderedSolids solid={renderedModel.solids} />}
      </ViewerCanvas>
    </>
  );
}

export function PlaygroundEditor({
  moduleTypes,
}: {
  moduleTypes: { moduleName: string; source: string }[];
}) {
  const { resolvedTheme } = useTheme();
  const { code, setCode, error } = useContext(PlaygroundContext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelReference = useRef<any | undefined>(undefined);
  const monaco = useMonaco();

  // Setup monaco

  function beforeMount(monaco: Monaco) {
    // validation settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      // noSemanticValidation: true,
      // noSyntaxValidation: true,
    });

    monaco.editor.registerLinkOpener({
      open(uri) {
        if (uri.authority !== documentationOrigin) return false;

        // TODO [>=1.0.0]: Open the url to the side in a panel and return true
        return window.open(uri.toString(), 'documentation') !== null;
      },
    });

    // compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      allowNonTsExtensions: true,
    });

    // extra libraries
    for (const { moduleName, source } of moduleTypes) {
      const librarySource = `declare module '${moduleName}' {
${source}
  }`;
      const libraryUri = monaco.Uri.file(`/node_modules/${moduleName}/index.d.ts`);

      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        librarySource,
        libraryUri.toString(),
      );

      // When resolving definitions and references, the editor will try to use created models.
      // Creating a model for the library allows "peek definition/references" commands to work with the library.

      // Dispose of the old model if it exists to support live updates
      monaco.editor.getModel(libraryUri)?.dispose();
      monaco.editor.createModel(librarySource, 'typescript', libraryUri);
    }
  }

  useEffect(() => {
    if (!monaco || !modelReference.current) return;

    monaco.editor.setModelMarkers(modelReference.current, 'tscad', [
      ...((error as esbuild.BuildFailure)?.errors ?? []).map((error_) => ({
        message: error_.text,
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: error_.location?.line ?? 1,
        startColumn: error_.location?.column ?? 1,
        endLineNumber: error_.location?.line ?? 1,
        endColumn: error_.location?.column ?? 1,
        source: 'tscad/build',
      })),
      ...((error as esbuild.BuildFailure)?.warnings ?? []).map((error_) => ({
        message: error_.text,
        source: 'tscad/build',
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: error_.location?.line ?? 1,
        startColumn: error_.location?.column ?? 1,
        endLineNumber: error_.location?.line ?? 1,
        endColumn: error_.location?.column ?? 1,
      })),
    ]);
  }, [error, monaco, modelReference]);

  const onMount: OnMount = (editor) => {
    const model = editor.getModel();

    modelReference.current = model;
  };

  return (
    <Editor
      height="100%"
      theme={resolvedTheme ? (resolvedTheme === 'dark' ? 'vs-dark' : 'light') : undefined}
      defaultLanguage="typescript"
      defaultValue={code}
      onChange={(code) => setCode(code ?? '')}
      beforeMount={beforeMount}
      onMount={onMount}
    />
  );
}

function Toast({
  children,
  variant = 'info',
}: {
  children: ReactNode;
  variant?: 'error' | 'info';
}) {
  const variantClassName = {
    info: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    error: 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300',
  }[variant];

  return (
    <div className="fixed bottom-2 z-50 flex w-full touch-none items-center justify-center p-2">
      <span className={`rounded-md px-2 py-1 text-sm ${variantClassName}`}>{children}</span>
    </div>
  );
}

export function State() {
  const { building, error } = useContext(PlaygroundContext);

  if (error) {
    const buildErrors = (error as esbuild.BuildFailure).errors;

    if (buildErrors?.length) {
      return <Toast variant="error">{buildErrors[0]!.text}</Toast>;
    }
    return <Toast variant="error">{error.message}</Toast>;
  }

  if (!building) return;

  return <Toast>Building...</Toast>;
}
