'use client';

import { SandpackLayout, SandpackPreview, SandpackProvider } from '@codesandbox/sandpack-react';
import { FileTabs, SandpackStack, useActiveCode, useSandpack } from '@codesandbox/sandpack-react';
import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

function WithProviders() {
  const { resolvedTheme } = useTheme();
  const { code, updateCode } = useActiveCode();
  const { sandpack } = useSandpack();

  return (
    <SandpackStack style={{ height: 'calc(100vh - 64px)', margin: 0 }}>
      <FileTabs />

      <div className="relative h-full flex-1">
        <Editor
          width="100%"
          height="100%"
          language="javascript"
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          key={sandpack.activeFile}
          defaultValue={code}
          onChange={(value) => updateCode(value || '')}
        />
      </div>
    </SandpackStack>
  );
}

export function ClientPlaygroundPage() {
  const { resolvedTheme } = useTheme();

  return (
    <main className="relative flex-1">
      <SandpackProvider
        template="vite-react-ts"
        theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      >
        <SandpackLayout className="h-[calc(100vh-64px)]">
          <WithProviders />
          <SandpackPreview style={{ height: 'calc(100vh - 64px)' }} />
        </SandpackLayout>
      </SandpackProvider>
    </main>
  );
}
