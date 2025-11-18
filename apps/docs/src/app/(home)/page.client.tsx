'use client';

import { Entities, ViewerCanvas } from '@tscad/viewer/src/viewer';
import { defaultModel } from '@/lib/playground';

export const SampleViewer = () => (
  <div className="absolute inset-0 overflow-hidden">
    <ViewerCanvas viewcube={false}>
      <Entities model={defaultModel} parameters={{ size: 13 }} />
    </ViewerCanvas>
  </div>
);
