import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  exports as modelingExports,
  name as modelingPackageName,
} from '@tscad/modeling/package.json';
import type { Metadata } from 'next';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PlaygroundEditor, PlaygroundPreview, PlaygroundProvider, State } from './page.client';

export function generateMetadata() {
  return { title: 'Playground' } satisfies Metadata;
}

export default async function PlaygroundPage() {
  const moduleTypes = await Promise.all(
    Object.entries(modelingExports)
      .filter(([, value]) => typeof value !== 'string')
      .map(async ([key, value]) => ({
        moduleName: path.join(modelingPackageName, key),
        source: await readFile(
          `./node_modules/@tscad/modeling/${(value as { default: string }).types}`,
          'utf8',
        ),
      })),
  );

  return (
    <PlaygroundProvider>
      <State />

      <div className="relative pt-[var(--fd-nav-height)] h-screen">
        <ResizablePanelGroup direction="horizontal" className="relative">
          <ResizablePanel defaultSize={50}>
            <PlaygroundEditor moduleTypes={moduleTypes} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50}>
            <PlaygroundPreview />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </PlaygroundProvider>
  );
}
