import { readFile } from 'node:fs/promises';
import type { Metadata } from 'next';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PlaygroundEditor, PlaygroundPreview, PlaygroundProvider, State } from './page.client';

export function generateMetadata() {
  return { title: 'Playground' } satisfies Metadata;
}

export default async function PlaygroundPage() {
  const moduleTypes = [
    {
      moduleName: '@tscad/modeling',
      source: await readFile('./node_modules/@tscad/modeling/out/index.d.ts', 'utf8'),
    },
    {
      moduleName: '@tscad/modeling/primitives',
      source: await readFile('./node_modules/@tscad/modeling/out/primitives/index.d.ts', 'utf8'),
    },
    {
      moduleName: '@tscad/modeling/colors',
      source: await readFile('./node_modules/@tscad/modeling/out/colors/index.d.ts', 'utf8'),
    },
  ];

  return (
    <PlaygroundProvider>
      <State />

      <ResizablePanelGroup direction="horizontal" className="flex h-full flex-1">
        <ResizablePanel defaultSize={50} className="flex-1">
          <PlaygroundEditor moduleTypes={moduleTypes} />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50} className="relative flex-1">
          <PlaygroundPreview />
        </ResizablePanel>
      </ResizablePanelGroup>
    </PlaygroundProvider>
  );
}
