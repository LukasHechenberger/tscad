/**
 * Builds the site (`build:site`). With VERCEL_ENVIRONMENT set (`preview` or `production`, by CI),
 * through `vercel build` instead: it runs `build:site` the way Vercel's builders do (Next.js builds
 * differently for Vercel) and writes the deployment to .vercel/output in the repository root, which
 * CI deploys with `vercel deploy --prebuilt`. Vercel itself can't build the site: the kernel needs
 * Rust, and Docker for the wasm build.
 */

import path from 'node:path';
import { $ } from 'bun';

const environment = process.env.VERCEL_ENVIRONMENT;

if (environment) {
  // The Vercel project's root directory is apps/docs, so the CLI runs from the repository root.
  const root = path.join(import.meta.dir, '../../..');
  const vercel = ['bunx', 'vercel@62.1.0', `--token=${process.env.VERCEL_TOKEN}`];
  await $`${vercel} pull --yes --environment=${environment}`.cwd(root);
  await $`${vercel} build ${environment === 'production' ? ['--prod'] : []}`.cwd(root);
} else {
  await $`bun run build:site`;
}
