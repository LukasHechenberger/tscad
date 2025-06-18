import { createReadStream } from 'node:fs';

export const dynamic = 'force-static';

export const GET = async () => {
  return new Response(
    createReadStream('./node_modules/esbuild-wasm/esbuild.wasm') as unknown as BodyInit,
    {},
  );
};
