import { HomeLayout } from 'fumadocs-ui/layouts/home';
import type { CSSProperties, ReactNode } from 'react';
import { baseOptions } from '@/app/layout.config';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout style={{ ['--fd-nav-height']: '57px' } as CSSProperties} {...baseOptions}>
      {children}
    </HomeLayout>
  );
}
