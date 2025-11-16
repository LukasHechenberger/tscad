import { highlight } from 'fumadocs-core/highlight';
import { Card } from 'fumadocs-ui/components/card';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import Link from 'next/link';
import { defaultCode } from '@/lib/playground';
import { SampleViewer } from './page.client';

export default async function HomePage() {
  const rendered = await highlight(defaultCode, {
    lang: 'typescript',
    components: {
      pre: (props) => <Pre {...props} />,
    },
    // other Shiki options
  });

  return (
    <div className="flex flex-1 justify-center items-center container p-4 mx-auto">
      <main className="flex flex-1 flex-col gap-12 h-full">
        <div className="flex items-center justify-center flex-col text-center mb-4 min-h-[30vh] flex-1">
          <h1 className="mb-4 text-2xl font-bold">tscad</h1>
          <p className="text-fd-muted-foreground mb-4">A modern CAD modeller for programmers.</p>
          <p className="text-fd-muted-foreground">
            View the{' '}
            <Link href="/docs" className="text-fd-foreground font-semibold underline">
              docs
            </Link>{' '}
            to get started or try it out in the{' '}
            <Link href="/playground" className="text-fd-foreground font-semibold underline">
              playground
            </Link>
            .
          </p>
        </div>

        <div>
          <div className="flex gap-4 flex-wrap flex-col md:flex-row">
            <CodeBlock className="self-stretch flex-1 w-full flex m-0">
              <Pre className="h-full w-full">{rendered}</Pre>
            </CodeBlock>

            <Card title="" className="flex-1 min-h-[300px] relative overflow-hidden">
              <SampleViewer />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
