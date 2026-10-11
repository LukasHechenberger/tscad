/**
 * Bundles the viewer's preview page (`@tscad/viewer/preview.html`) into out/preview, which
 * `tscad dev` serves as static files. Prebuilt, because Bun's on-the-fly HTML bundling resolves
 * asset URLs against the working directory, which is the user's project, not this package.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const page = fileURLToPath(import.meta.resolve('@tscad/viewer/preview.html'));
const result = await Bun.build({
  entrypoints: [page],
  outdir: path.join(import.meta.dir, '../out/preview'),
  target: 'browser',
  minify: true,
  sourcemap: 'linked',
});
if (!result.success) throw new AggregateError(result.logs, 'Building the preview page failed');
