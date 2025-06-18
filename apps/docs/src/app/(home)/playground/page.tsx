'use client';

import { GizmoHelper, GizmoViewcube, Grid, OrbitControls, Stage } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { solidToTHREE } from '@tscad/modeling/convert';
import { cube } from '@tscad/modeling/primitives';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { bundleCode } from '@/lib/esbuild';

let worker: Worker;

async function runInSandbox(tsCode: string): Promise<any> {
  worker ??= worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  const jsCode = await bundleCode(tsCode); // transpileTS(tsCode);

  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      console.log('Worker message:', e);
      const { result, error } = e.data;
      error ? reject(error) : resolve(result);
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

export default function PlaygroundPage() {
  const { theme, resolvedTheme } = useTheme();

  const [geometries, setGeometries] = useState<any[]>([solidToTHREE(cube({ size: 13 }))]);

  // Setup monaco
  const monaco = useMonaco();
  useEffect(() => {
    if (monaco) {
      // Add additonal d.ts files to the JavaScript language service and change.
      // Also change the default compilation options.
      // The sample below shows how a class Facts is declared and introduced
      // to the system and how the compiler is told to use ES6 (target=2).

      // validation settings
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: true,
        noSyntaxValidation: false,
      });

      // compiler options
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        // typeRoots: ['node_modules/@types'],
        // paths: {
        //   '@tscad/modeling/primitives': ['file:///node_modules/@tscad/modeling/primitives.d.ts'],
        // },
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

  /** @deprecated */
  export function sphere(options: any): void
}
`;

      const libUri = 'file:///node_modules/@tscad/modeling/primitives.d.ts';
      monaco.languages.typescript.javascriptDefaults.addExtraLib(libSource, libUri);
      // When resolving definitions and references, the editor will try to use created models.
      // Creating a model for the library allows "peek definition/references" commands to work with the library.
      monaco.editor.createModel(libSource, 'typescript', monaco.Uri.parse(libUri));
    }
  }, [monaco]);

  async function handleCodeChange(value: string | undefined) {
    if (value) {
      const result = await runInSandbox(value);

      if (result) {
        console.log('Sandbox result:', result);
        const geometries = Array.isArray(result) ? result : [result];
        setGeometries(geometries.map(solidToTHREE));
      }
    }
  }

  return (
    <div className="h-[calc(100vh-var(--fd-nav-height))] flex">
      <div className="flex-1">
        <Editor
          height="100%"
          theme={resolvedTheme ? (resolvedTheme === 'dark' ? 'vs-dark' : 'light') : undefined}
          defaultLanguage="typescript"
          defaultValue={`import { cube, sphere } from '@tscad/modeling/primitives';
            

/** Use this method to create your model */
export function main() {
  return [cube({ size: 1.5 }), sphere({})];
}`}
          onChange={handleCodeChange}
        />
      </div>
      <div className="flex-1">
        <Canvas shadows camera={{ position: [5, 5, 5], fov: 50 }}>
          <Stage
            adjustCamera
            intensity={0.5}
            preset="rembrandt"
            shadows={{ type: 'accumulative', color: 'skyblue', colorBlend: 2, opacity: 1 }}
          >
            <Entities geometries={geometries} />
          </Stage>

          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewcube />
          </GizmoHelper>

          <OrbitControls makeDefault />
        </Canvas>
      </div>
    </div>
  );
}
