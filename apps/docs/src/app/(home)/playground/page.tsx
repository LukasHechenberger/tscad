import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Metadata } from 'next';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PlaygroundEditor, PlaygroundPreview, PlaygroundProvider, State } from './page.client';

export function generateMetadata() {
  return { title: 'Playground' } satisfies Metadata;
}

/** Declaration files under `directory` (recursively), keyed by their path below node_modules. */
async function declarations(moduleName: string, directory = '') {
  const root = path.join('./node_modules', moduleName);
  const files = await readdir(path.join(root, directory), { recursive: true });
  return Promise.all(
    files
      .filter((file) => file.endsWith('.d.ts'))
      .map(async (file) => ({
        path: path.posix.join(moduleName, directory, file),
        source: await readFile(path.join(root, directory, file), 'utf8'),
      })),
  );
}

export default async function PlaygroundPage() {
  const modeling = await declarations('@tscad/modeling', 'out');
  const typeFiles = [
    // @tscad/modeling, as built (index.d.ts and the modules it re-exports)
    ...modeling.map((file) => ({
      ...file,
      path: file.path.replace('/out/', '/'),
    })),
    // zod, which the playground provides for model parameters
    ...(await declarations('zod', 'v4')),
    { path: 'zod/index.d.ts', source: await readFile('./node_modules/zod/index.d.ts', 'utf8') },
  ].filter((file) => !file.path.includes('/standalone/'));

  return (
    <PlaygroundProvider>
      <State />

      <ResizablePanelGroup direction="horizontal" className="flex h-full flex-1">
        <ResizablePanel defaultSize={50} className="flex-1">
          <PlaygroundEditor typeFiles={typeFiles} />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel defaultSize={50} className="relative flex-1">
          <PlaygroundPreview />
        </ResizablePanel>
      </ResizablePanelGroup>
    </PlaygroundProvider>
  );
}
