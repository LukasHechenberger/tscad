import { readFile } from 'node:fs/promises';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PlaygroundEditor, PlaygroundPreview, PlaygroundProvider, State } from './page.client';

export default async function PlaygroundPage() {
  const moduleTypes = [
    {
      moduleName: '@tscad/modeling/primitives',
      source: await readFile('./node_modules/@tscad/modeling/out/primitives/index.d.ts', 'utf8'),
    },
  ];

  return (
    <PlaygroundProvider>
      <State />

      <div className="h-[calc(100vh-var(--fd-nav-height))]">
        <ResizablePanelGroup
          direction="horizontal"
          className="relative !h-[calc(100vh-var(--fd-nav-height))]"
        >
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
