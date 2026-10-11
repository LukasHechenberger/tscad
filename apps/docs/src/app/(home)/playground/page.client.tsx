'use client';

import { observable } from '@legendapp/state';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { use$ } from '@legendapp/state/react';
import { syncObservable } from '@legendapp/state/sync';
import Editor, { type Monaco, type OnMount, useMonaco } from '@monaco-editor/react';
import { shikiToMonaco, textmateThemeToMonacoTheme } from '@shikijs/monaco';
import { createViewer, type Viewer } from '@tscad/viewer';
import '@tscad/viewer/style.css';
import type * as esbuild from 'esbuild-wasm';
import { useTheme } from 'next-themes';
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { bundleCode } from '@/lib/esbuild';
import { defaultCode } from '@/lib/playground';
import { homepage } from '../../../../package.json';
import type { PreparedModel, RenderedModel, WorkerResponse } from './worker';

const documentationOrigin = new URL(homepage).host;

/** The themes of the docs' code blocks (source.config.ts), so the editor colors code the same way. */
const editorThemes = { light: 'github-light', dark: 'github-dark' } as const;

let highlighter: Promise<HighlighterCore> | undefined;

/** A CSS color as `#rrggbb`, as Monaco themes need it (computed styles may be `oklch(…)` and the like). */
function hexColor(css: string): string | undefined {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return undefined;
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/** Shiki with just what the editor needs; the JavaScript regex engine avoids loading Oniguruma's wasm. */
function loadHighlighter() {
  highlighter ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [import('shiki/langs/typescript.mjs')],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

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

  return new Promise<RenderedModel>((resolve, reject) => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type !== 'rendered') {
        reject(new Error(`Unexpected response type: ${data.type}`));
        return;
      }
      const { result, error } = data as { error?: Error; result?: RenderedModel };

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
  renderedModel?: RenderedModel;
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
  const [renderedModel, setRenderedModel] = useState<RenderedModel | undefined>();

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

/** The kernel's output in the embeddable viewer, which also shows the parameter form. */
export function PlaygroundPreview() {
  const { renderedModel, preparedModel, building, setParameters } = useContext(PlaygroundContext);
  const { resolvedTheme } = useTheme();
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | undefined>(undefined); // eslint-disable-line unicorn/no-useless-undefined -- useRef needs an argument

  useEffect(() => {
    const created = createViewer(container.current!, { onParams: setParameters, urlSync: false });
    viewer.current = created;
    return () => created.dispose();
  }, [setParameters]);

  useEffect(() => {
    viewer.current?.setTheme(resolvedTheme === 'dark' ? 'dark' : 'light');
  }, [resolvedTheme]);

  useEffect(() => {
    if (preparedModel) {
      viewer.current?.showParameters(
        preparedModel.parametersSchema,
        preparedModel.defaultParameters ?? {},
      );
    }
  }, [preparedModel]);

  useEffect(() => {
    if (!renderedModel) return;
    void viewer.current?.showModel(renderedModel.glb);
    viewer.current?.setStatus(
      `wasm kernel in your browser · rendered in ${renderedModel.renderMs} ms`,
    );
  }, [renderedModel]);

  return (
    <div
      ref={container}
      className="absolute inset-0"
      style={{ transition: 'opacity 0.1s ease-in-out', opacity: building ? 0.5 : 1 }}
    />
  );
}

export function PlaygroundEditor({
  typeFiles,
}: {
  /** Declaration files of the modules user code may import, by their node_modules path. */
  typeFiles: { path: string; source: string }[];
}) {
  const { resolvedTheme } = useTheme();
  const { code, setCode, error } = useContext(PlaygroundContext);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, unicorn/no-useless-undefined -- useRef needs an argument
  const modelReference = useRef<any | undefined>(undefined);
  const monaco = useMonaco();
  // The editor's container, whose `bg-fd-card` the editor takes as its background.
  const containerReference = useRef<HTMLElement | null>(null);
  // The editor mounts once Shiki is loaded, so it never shows Monaco's own colors first.
  const [shiki, setShiki] = useState<HighlighterCore | undefined>();
  useEffect(() => {
    void loadHighlighter().then(setShiki);
  }, []);

  // Setup monaco

  function beforeMount(monaco: Monaco) {
    // Shiki's TextMate grammar and themes instead of Monaco's tokenizer and built-in themes.
    if (shiki) shikiToMonaco(shiki, monaco);

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
    const { typescript } = monaco.languages;
    typescript.typescriptDefaults.setCompilerOptions({
      target: typescript.ScriptTarget.ES2020,
      module: typescript.ModuleKind.ESNext,
      moduleResolution: typescript.ModuleResolutionKind.NodeJs,
      allowNonTsExtensions: true,
      strict: true,
    });

    // extra libraries: declaration files at their node_modules paths, so imports resolve
    for (const { path, source } of typeFiles) {
      const libraryUri = monaco.Uri.file(`/node_modules/${path}`);
      typescript.typescriptDefaults.addExtraLib(source, libraryUri.toString());

      // When resolving definitions and references, the editor will try to use created models.
      // Creating a model for the library allows "peek definition/references" commands to work with the library.

      // Dispose of the old model if it exists to support live updates
      monaco.editor.getModel(libraryUri)?.dispose();
      monaco.editor.createModel(source, 'typescript', libraryUri);
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

  /**
   * The current theme, with the editor background set to its container's `bg-fd-card`, like the
   * docs' code blocks. An opaque color, not a transparent one: the minimap's canvas would draw that black.
   */
  function applyTheme(monaco: Monaco) {
    const name = resolvedTheme === 'dark' ? editorThemes.dark : editorThemes.light;
    const container = containerReference.current;
    const background = container && hexColor(getComputedStyle(container).backgroundColor);
    if (!shiki || !background) return;
    // Typed as Monaco's own theme data: MonacoTheme refers to monaco-editor-core, which isn't installed.
    const theme = textmateThemeToMonacoTheme(shiki.getTheme(name)) as Parameters<
      Monaco['editor']['defineTheme']
    >[1];
    monaco.editor.defineTheme(name, {
      ...theme,
      colors: { ...theme.colors, 'editor.background': background },
    });
    monaco.editor.setTheme(name);
  }

  // Again when the site's theme changes, which changes `bg-fd-card` too.
  useEffect(() => {
    if (monaco) applyTheme(monaco);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applyTheme reads the latest theme itself
  }, [resolvedTheme, monaco]);

  const onMount: OnMount = (editor, monaco) => {
    const model = editor.getModel();

    modelReference.current = model;
    containerReference.current = editor.getContainerDomNode();
    applyTheme(monaco);
  };

  if (!shiki) return;

  return (
    <Editor
      height="100%"
      className="bg-fd-card"
      theme={resolvedTheme === 'dark' ? editorThemes.dark : editorThemes.light}
      defaultLanguage="typescript"
      // A file path, so imports resolve against the declarations in file:///node_modules
      path="file:///model.ts"
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
