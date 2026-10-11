/**
 * Renders the playground's default model (src/lib/playground/models.ts) to public/sample.glb,
 * which the home page shows without loading the kernel in the browser.
 */

import path from 'node:path';
import { loadKernel } from '@tscad/kernel';
import sample from '../src/lib/playground/models';

const kernel = await loadKernel();
await Bun.write(
  path.join(import.meta.dir, '../public/sample.glb'),
  kernel.render(await sample.build(), 'glb'),
);
