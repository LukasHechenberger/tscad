'use client';

import { getSandpackCssText } from '@codesandbox/sandpack-react';
import { useServerInsertedHTML } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Ensures CSSinJS styles are loaded server side.
 */
export const SandPackCSS = (): ReactNode => {
  useServerInsertedHTML(() => {
    return <style dangerouslySetInnerHTML={{ __html: getSandpackCssText() }} id="sandpack" />;
  });

  return;
};
