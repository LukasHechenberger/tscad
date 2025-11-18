import { Banner } from 'fumadocs-ui/components/banner';
import { RootProvider } from 'fumadocs-ui/provider/next';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
});

export function generateMetadata() {
  return {
    title: {
      default: 'tscad',
      template: '%s · tscad',
    },
  } satisfies Metadata;
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <Banner variant="rainbow" id="development-warning">
          tscad is in early development
        </Banner>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
