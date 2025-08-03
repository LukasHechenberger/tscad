'use client';

import { type Observable, observable } from '@legendapp/state';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { use$ } from '@legendapp/state/react';
import { syncObservable } from '@legendapp/state/sync';
import Editor, { type Monaco, type OnMount, useMonaco } from '@monaco-editor/react';
import { GizmoHelper, GizmoViewcube, Grid, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import type { Vector2 } from '@tscad/modeling';
import { solidToTHREE } from '@tscad/modeling/convert';
import type * as esbuild from 'esbuild-wasm';
import { folder, Leva, useControls } from 'leva';
import { useTheme } from 'next-themes';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bundleCode } from '@/lib/esbuild';
import { homepage } from '../../../../package.json';

const documentationOrigin = new URL(homepage).host;

let worker: Worker;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solid = any;
type Model = Solid | Solid[];

class WorkerError extends Error {
  constructor(
    message: string,
    public stack?: string,
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

async function runInSandbox(tsCode: string): Promise<Model> {
  worker ??= new Worker(new URL('worker.ts', import.meta.url), { type: 'module' });

  let jsCode: string;

  const result = await bundleCode(tsCode);
  if (result.text) jsCode = result.text;
  else throw result;

  return new Promise((resolve, reject) => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    worker.onmessage = ({ data }) => {
      const { result, error } = data;

      if (result) resolve(result);
      else if (error) {
        const remoteError = new WorkerError(error.message, error.stack);

        reject(remoteError);
      } else {
        reject(new Error(`Unexpected response: ${JSON.stringify(data)}`));
      }
    };
    worker.postMessage({ code: jsCode });
  });
}

function Entities() {
  const { geometries } = useContext(PlaygroundContext);
  // FIXME [>=1.0.0]: Catch + report errors
  const rendered = useMemo(
    () => (Array.isArray(geometries) ? geometries : [geometries]).map((s) => solidToTHREE(s)),
    [geometries],
  );

  return rendered.map((entity, index) => (
    // eslint-disable-next-line react/no-unknown-property
    <mesh key={index} castShadow geometry={entity}>
      <meshStandardMaterial color="orange" />

      {/* FIXME [>=1.0.0]: Optionally enable (one of both) */}
      {/* <Wireframe geometry={entity} /> */}
      {/* <Outlines thickness={0.06} color="aquamarine" /> */}
    </mesh>
  ));
}

type PlaygroundContextType = {
  code: string;
  setCode: (code: string) => void;
  geometries: Model;
  building: boolean;
  error?: Error;
};

const PlaygroundContext = createContext<PlaygroundContextType>(
  undefined as unknown as PlaygroundContextType,
);

const defaultCode = `import { cube, sphere } from '@tscad/modeling/primitives';

/** Use this method to create your model */
export function main() {
  return [
    cube({ size: 1.5, center: [0, 0.75, 0] }),
    sphere({ radius: 1.2, center: [0, 1.2, 0] }),
  ];
}`;

const code$ = observable(defaultCode);
syncObservable(code$, {
  persist: {
    name: 'playground.code',
    plugin: ObservablePersistLocalStorage,
  },
});

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [geometries, setGeometries] = useState<Model>([]);
  const code = use$(code$);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    setBuilding(true);
    setError(undefined);

    let outdated = false;
    const updateGeometries = async () => {
      try {
        const result = await runInSandbox(code);
        if (outdated) {
          console.info('Skipping state update, component is outdated');
        } else {
          setGeometries(result);
          setBuilding(false);
        }
      } catch (error) {
        if (!outdated) {
          setError(error as Error);
          setBuilding(false);
        }
      }
    };

    updateGeometries();

    return () => {
      outdated = true; // Mark as outdated to prevent state updates after unmount
    };
  }, [code]);

  return (
    <PlaygroundContext.Provider value={{ code, setCode: code$.set, geometries, building, error }}>
      {children}
    </PlaygroundContext.Provider>
  );
}

const defaultSettings = { grid: { enabled: true } };
const folderNames = { grid: 'Grid' } satisfies { [K in keyof typeof defaultSettings]: string };
const settings$ = observable(defaultSettings);

// Persist the observable to the named key of the global persist plugin
syncObservable(settings$, {
  persist: {
    name: 'playground.settings',
    plugin: ObservablePersistLocalStorage,
  },
});

export function PlaygroundPreview() {
  const { resolvedTheme } = useTheme();
  const values = use$(settings$);

  useControls(
    Object.fromEntries(
      Object.entries(values).map(([folderKey, settings]) => [
        folderNames[folderKey as keyof typeof folderNames],
        folder(
          Object.fromEntries(
            Object.entries(settings).map(([key, value]) => [
              key,
              {
                value,
                onChange: (value) => (settings$ as Observable)[folderKey][key].set(value),
              },
            ]),
          ),
          {
            collapsed: false,
          },
        ),
      ]),
    ),
    { collapsed: false },
    [values],
  );

  const { enabled: gridEnabled } = values.grid;

  const gridSize = [10, 10] as Vector2; // TODO [>=1.0.0]: Make this configurable
  const gridConfig = {
    infiniteGrid: true,
    cellSize: 1,
    sectionSize: 10,
    followCamera: true,
    // FIXME [>=1.0.0]: Colors from theme
  };
  return (
    <>
      <div className="z-1 absolute w-[300px] top-4 right-4">
        <Leva
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
          collapsed
          titleBar={{ drag: false, title: 'View Options' }}
        />
      </div>

      <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
        <Stage
          adjustCamera
          intensity={0.5}
          preset="rembrandt"
          shadows={{
            type: 'contact',
            color: '#555',
            colorBlend: 1,
            opacity: 0.8,
            intensity: 0.5,
            position: [0, 0, 0],
          }}
        >
          <Entities />

          {gridEnabled && <Grid side={2} position={[0, 0, 0]} args={gridSize} {...gridConfig} />}
        </Stage>

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          {/* NOTE: Colors should come from theme */}
          <GizmoViewcube
            {...(resolvedTheme === 'dark'
              ? {
                  // Dark theme colors
                  color: '#333',
                  textColor: 'gray',
                  strokeColor: 'gray',
                  hoverColor: '#777',
                }
              : {
                  // Light theme colors
                  color: 'white',
                  textColor: 'black',
                  strokeColor: 'black',
                  hoverColor: '#777',
                })}
          />
        </GizmoHelper>

        <OrbitControls makeDefault />
      </Canvas>
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
      noSemanticValidation: true,
      noSyntaxValidation: true,
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
      const libraryUri = monaco.Uri.file(`/node_modules/${moduleName}/primitives.d.ts`);

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
    <div className="fixed w-full z-50 bottom-2 flex items-center justify-center touch-none p-2">
      <span className={`text-sm px-2 py-1 rounded-md ${variantClassName}`}>{children}</span>
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
