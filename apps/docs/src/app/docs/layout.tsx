import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';

export default function Layout({ children }: { children: ReactNode }) {
  const options = {
    tree: source.pageTree,
    ...baseOptions,
    nav: {
      ...baseOptions.nav,
      mode: 'top',
    },
  } satisfies DocsLayoutProps;

  return <DocsLayout {...options}>{children}</DocsLayout>;
}
