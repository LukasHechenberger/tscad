import { DocsLayout, type DocsLayoutProps } from 'fumadocs-ui/layouts/notebook';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  const options = {
    ...baseOptions,
    tree: { name: 'root', children: [] },
    nav: { mode: 'top', ...baseOptions.nav },
    sidebar: { collapsible: false },
  } satisfies DocsLayoutProps;

  return (
    <DocsLayout {...options} containerProps={{ className: '![--fd-sidebar-width:0px]' }}>
      {children}
    </DocsLayout>
  );
}
