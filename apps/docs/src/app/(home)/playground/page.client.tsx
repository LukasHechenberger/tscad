'use client';

import { SandpackLayout, SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react';
import { FileTabs, SandpackStack, useActiveCode, useSandpack } from '@codesandbox/sandpack-react';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

function WithProviders() {
  const { resolvedTheme } = useTheme();
  const { code, updateCode } = useActiveCode();
  const { sandpack } = useSandpack();
  const monaco = useMonaco();

  useEffect(() => {
    if (!monaco) return;

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      skipLibCheck: true,
    });

    // monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    //   noSemanticValidation: false,
    //   noSyntaxValidation: false,
    // });
  }, [monaco]);

  return (
    <SandpackStack style={{ height: 'calc(100vh - 64px)', margin: 0 }}>
      <FileTabs />

      <div className="relative h-full flex-1">
        <Editor
          width="100%"
          height="100%"
          language="typescript"
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          key={sandpack.activeFile}
          path={sandpack.activeFile}
          defaultValue={code}
          onChange={(value) => updateCode(value || '')}
        />
      </div>
    </SandpackStack>
  );
}

export function ClientPlaygroundPage() {
  const { resolvedTheme } = useTheme();

  console.log('resolvedTheme', { resolvedTheme });

  return (
    <main className="relative flex-1">
      <SandpackProvider
        template="vite-react-ts"
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
        files={{
          '/App.tsx': `
          
// import { Viewer } from '@tscad/viewer/src/viewer.tsx' 
// import model from './model.ts';

export default function App() {
  return (
    <div>
      <b>Viewer</b>
      // <Viewer model={model} />
    </div>
  );
}`,
          '/model.ts': `import { defineModel } from '@tscad/modeling';
          
export default defineModel({
  model: () => {
    return []
  } 
})`,
        }}
        customSetup={{
          entry: '/App.tsx',

          dependencies: {
            '@tscad/modeling': 'latest',
            react: '^19.2.0',
          },
        }}
        options={{
          visibleFiles: ['/App.tsx', '/model.ts'],
          activeFile: '/model.ts',
        }}
      >
        <SandpackLayout className="h-[calc(100vh-64px)]">
          <WithProviders />

          <SandpackPreview style={{ height: 'calc(100vh - 64px)' }} />
        </SandpackLayout>
      </SandpackProvider>
    </main>
  );
}
