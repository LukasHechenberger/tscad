'use client';

import { GizmoHelper, GizmoViewcube, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { solidToTHREE } from '@tscad/modeling/convert';
import Editor, { type Monaco, useMonaco, OnMount } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { bundleCode } from '@/lib/esbuild';
import type * as esbuild from 'esbuild-wasm';

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

async function runInSandbox(tsCode: string): Promise<any> {
  worker ??= worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  let jsCode: string;

  const result = await bundleCode(tsCode);
  if (result.text) jsCode = result.text;
  else throw result;

  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const { result, error } = e.data;

      if (result) resolve(result);
      else if (error) {
        const remoteError = new WorkerError(error.message, error.stack);

        reject(remoteError);
      } else {
        reject(new Error(`Unexpected response: ${JSON.stringify(e.data)}`));
      }
    };
    worker.postMessage({ code: jsCode });
  });
}

function Entities() {
  const { geometries } = useContext(PlaygroundContext);
  // FIXME: Catch + report errors
  const rendered = useMemo(() => geometries.map(solidToTHREE), [geometries]);

  return rendered.map((entity, index) => (
    <mesh key={index} castShadow geometry={entity}>
      <meshStandardMaterial color="orange" />
    </mesh>
  ));
}

type PlaygroundContextType = {
  code: string;
  setCode: (code: string) => void;
  geometries: any[];
  building: boolean;
  error?: Error;
};
const PlaygroundContext = createContext<PlaygroundContextType>(
  undefined as unknown as PlaygroundContextType,
);

const defaultCode = `import { cube, sphere } from '@tscad/modeling/primitives';  

/** Use this method to create your model */
export function main() {
  return [cube({ size: 1.5 }), sphere({})];
}`;

function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [geometries, setGeometries] = useState<any[]>([]);
  const [code, setCode] = useState<string>(defaultCode);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  useEffect(() => {
    setBuilding(true);
    setError(undefined);

    let outdated = false;
    const updateGeometries = async () => {
      try {
        const result = await runInSandbox(code);
        if (!outdated) {
          setGeometries(result);
          setBuilding(false);
        } else console.info('Skipping state update, component is outdated');
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
    <PlaygroundContext.Provider value={{ code, setCode, geometries, building, error }}>
      {children}
    </PlaygroundContext.Provider>
  );
}

function PlaygroundPreview() {
  return (
    <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
      <Stage
        adjustCamera
        intensity={0.5}
        preset="rembrandt"
        shadows={{ type: 'accumulative', color: 'skyblue', colorBlend: 2, opacity: 1 }}
      >
        <Entities />
      </Stage>

      <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
        <GizmoViewcube />
      </GizmoHelper>

      <OrbitControls makeDefault />
    </Canvas>
  );
}

function PlaygroundEditor() {
  const { resolvedTheme } = useTheme();
  const { code, setCode, error } = useContext(PlaygroundContext);
  const modelRef = useRef<any | undefined>(undefined);
  const monaco = useMonaco();

  // Setup monaco
  function beforeMount(monaco: Monaco) {
    // validation settings
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });

    // compiler options
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2015,
      allowNonTsExtensions: true,
    });

    // extra libraries
    const libSource = `
        declare module '@tscad/modeling/primitives' {

    export type Vector3 = [number, number, number];

    /** Options used in the {@link cube} method. */
    interface CubeOptions {
      /** Center of the cube @default [0, 0, 0] */
      center?: Vector3;
      /** Size of the cube @default 2 */
      size?: number;
    }
    /**
     * Construct an axis-aligned solid cube in three dimensional space with six square faces.
     * @see https://tscad.vercel.app/docs/primitives/cube
     */
    export function cube(options: CubeOptions): void;

    /** @deprecated Not typed yet.... */
    export function sphere(options: any): void
  }
  `;

    const libUri = monaco.Uri.file('/node_modules/@tscad/modeling/primitives.d.ts');
    monaco.languages.typescript.javascriptDefaults.addExtraLib(libSource, libUri.toString());
    // When resolving definitions and references, the editor will try to use created models.
    // Creating a model for the library allows "peek definition/references" commands to work with the library.

    // Dispose of the old model if it exists to support live updates
    monaco.editor.getModel(libUri)?.dispose();
    monaco.editor.createModel(libSource, 'typescript', libUri);
  }

  useEffect(() => {
    if (!monaco || !modelRef.current) return;

    monaco.editor.setModelMarkers(modelRef.current, 'owner', [
      ...((error as esbuild.BuildFailure)?.errors ?? []).map((err) => ({
        message: err.text,
        severity: monaco.MarkerSeverity.Error,
        startLineNumber: err.location?.line ?? 1,
        startColumn: err.location?.column ?? 1,
        endLineNumber: err.location?.line ?? 1,
        endColumn: err.location?.column ?? 1,
        source: 'esbuild',
      })),
      ...((error as esbuild.BuildFailure)?.warnings ?? []).map((err) => ({
        message: err.text,
        source: 'esbuild',
        severity: monaco.MarkerSeverity.Warning,
        startLineNumber: err.location?.line ?? 1,
        startColumn: err.location?.column ?? 1,
        endLineNumber: err.location?.line ?? 1,
        endColumn: err.location?.column ?? 1,
      })),
    ]);
  }, [error, monaco, modelRef]);

  const onMount: OnMount = (editor) => {
    const model = editor.getModel();

    modelRef.current = model;
  };

  return (
    <Editor
      height="100%"
      theme={resolvedTheme ? (resolvedTheme === 'dark' ? 'vs-dark' : 'light') : undefined}
      defaultLanguage="typescript"
      defaultValue={code}
      onChange={(e) => setCode(e ?? '')}
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

function State() {
  const { building, error } = useContext(PlaygroundContext);

  if (error) {
    const buildErrors = (error as esbuild.BuildFailure).errors;

    if (buildErrors?.length) {
      return <Toast variant="error">{buildErrors[0].text}</Toast>;
    }
    return <Toast variant="error">{error.message}</Toast>;
  }

  if (!building) return null;

  return <Toast>Building...</Toast>;
}

export default function PlaygroundPage() {
  return (
    <PlaygroundProvider>
      <State />

      <div className="h-[calc(100vh-var(--fd-nav-height))] flex">
        <div className="flex-1">
          <PlaygroundEditor />
        </div>
        <div className="flex-1">
          <PlaygroundPreview />
        </div>
      </div>
    </PlaygroundProvider>
  );
}
