'use client';

import { getRuntime } from '@tscad/modeling/runtime';
import { Entities, ViewerCanvas } from '@tscad/viewer/src/viewer';
import { defaultModel } from '@/lib/playground';

export const SampleViewer = () => {
  const model = getRuntime(defaultModel);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <ViewerCanvas viewcube={false}>
        <Entities model={model} parameters={{ size: 13 }} />
      </ViewerCanvas>
    </div>
  );
};
