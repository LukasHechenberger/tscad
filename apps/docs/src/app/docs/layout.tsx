import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';
import { source } from '@/lib/source';

export function generateMetadata() {
  return {
    title: {
      default: 'tscad documentation',
      template: '%s · tscad documentation',
    },
  } satisfies Metadata;
}

export default function Layout({ children }: { children: ReactNode }) {
  const options = {
    tree: source.pageTree,
    ...baseOptions,
  } satisfies DocsLayoutProps;

  return <DocsLayout {...options}>{children}</DocsLayout>;
}
