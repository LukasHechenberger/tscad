import { readFile } from 'node:fs/promises';
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

      <div className="h-[calc(100vh-var(--fd-nav-height))] flex">
        <div className="flex-1">
          <PlaygroundEditor moduleTypes={moduleTypes} />
        </div>
        <div className="flex-1">
          <PlaygroundPreview />
        </div>
      </div>
    </PlaygroundProvider>
  );
}
