import { HomeLayout, type HomeLayoutProps } from 'fumadocs-ui/layouts/home';
import type { ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  const options = {
    ...baseOptions,
    nav: { ...baseOptions.nav },
  } satisfies HomeLayoutProps;

  return (
    <HomeLayout {...options}>
      <div className="flex flex-1 flex-col">{children}</div>
    </HomeLayout>
  );
}
