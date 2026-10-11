'use client';

import { createViewer } from '@tscad/viewer';
import '@tscad/viewer/style.css';
import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';

/** The playground's default model, rendered at build time (scripts/render-sample.ts). */
export const SampleViewer = () => {
  const container = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const viewer = createViewer(container.current!, {
      onParams: () => {},
      urlSync: false,
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
    });
    fetch('/sample.glb')
      .then((response) => response.arrayBuffer())
      .then((glb) => viewer.showModel(glb))
      .catch((error: Error) => viewer.showError(`Could not load the sample: ${error.message}`));
    return () => viewer.dispose();
  }, [resolvedTheme]);

  return <div ref={container} className="absolute inset-0 overflow-hidden" />;
};
