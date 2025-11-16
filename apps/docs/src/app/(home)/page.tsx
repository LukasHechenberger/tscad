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
    <div className="container mx-auto flex flex-1 items-center justify-center p-4">
      <main className="flex h-full flex-1 flex-col gap-12">
        <div className="mb-4 flex min-h-[30vh] flex-1 flex-col items-center justify-center text-center">
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
          <div className="flex flex-col flex-wrap gap-4 md:flex-row">
            <CodeBlock className="m-0 flex w-full flex-1 self-stretch">
              <Pre className="h-full w-full">{rendered}</Pre>
            </CodeBlock>

            <Card title="" className="relative min-h-[300px] flex-1 overflow-hidden">
              <SampleViewer />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
