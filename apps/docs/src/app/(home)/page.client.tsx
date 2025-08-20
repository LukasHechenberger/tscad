'use client';

import Viewer from '@tscad/viewer/src/viewer';
import { defaultModel } from '@/lib/playground';

export const SampleViewer = () => (
  <div className="absolute inset-0">
    <Viewer model={defaultModel} viewcube={false} />
  </div>
);
