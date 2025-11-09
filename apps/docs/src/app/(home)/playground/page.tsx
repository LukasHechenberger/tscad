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

      <div className="relative pt-[var(--fd-nav-height)] h-screen">
        <ResizablePanelGroup direction="horizontal" className="relative">
          <ResizablePanel>
            <PlaygroundEditor moduleTypes={moduleTypes} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel>
            <PlaygroundPreview />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </PlaygroundProvider>
  );
}
