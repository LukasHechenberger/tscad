'use client';

import { GizmoHelper, GizmoViewcube, Grid, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { solidToTHREE } from '@tscad/modeling/convert';
import { cube } from '@tscad/modeling/primitives';
import Editor, { Monaco, useMonaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { bundleCode } from '@/lib/esbuild';

let worker: Worker;

async function runInSandbox(tsCode: string): Promise<any> {
  worker ??= worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const jsCode = await bundleCode(tsCode);

  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      console.log('Worker message:', e);
      const { result, error } = e.data;
      error ? reject(new Error(error)) : resolve(result);
    };
    worker.postMessage({ code: jsCode });
  });
}

function Entities({ geometries }: { geometries: any[] }) {
  return geometries.map((entity, index) => (
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
          console.error('Error updating geometries:', typeof error, error);
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

  useEffect(() => console.log({ geometries }), [geometries]);

  return (
    <PlaygroundContext.Provider value={{ code, setCode, geometries, building, error }}>
      {children}
    </PlaygroundContext.Provider>
  );
}

function PlaygroundPreview() {
  const { geometries } = useContext(PlaygroundContext);
  const rendered = useMemo(() => geometries.map(solidToTHREE), [geometries]);

  return (
    <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
      <Stage
        adjustCamera
        intensity={0.5}
        preset="rembrandt"
        shadows={{ type: 'accumulative', color: 'skyblue', colorBlend: 2, opacity: 1 }}
      >
        <Entities geometries={rendered} />
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
  const { code, setCode } = useContext(PlaygroundContext);

  // Setup monaco
  function beforeMount(monaco: Monaco) {
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

    /** @deprecated Not typed yet... */
    export function sphere(options: any): void
  }
  `;

    const libUri = monaco.Uri.file('/node_modules/@tscad/modeling/primitives.d.ts');
    monaco.languages.typescript.javascriptDefaults.addExtraLib(libSource, libUri.toString());
    // When resolving definitions and references, the editor will try to use created models.
    // Creating a model for the library allows "peek definition/references" commands to work with the library.
    monaco.editor.createModel(libSource, 'typescript', libUri);
  }

  return (
    <Editor
      height="100%"
      theme={resolvedTheme ? (resolvedTheme === 'dark' ? 'vs-dark' : 'light') : undefined}
      defaultLanguage="typescript"
      defaultValue={code}
      onChange={(e) => setCode(e ?? '')}
      beforeMount={beforeMount}
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

  console.dir({ building, error });

  if (error) {
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
