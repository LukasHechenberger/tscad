import { createReadStream } from 'node:fs';

export const dynamic = 'force-static';

/** The tscad kernel as WebAssembly (`bun run build:wasm` in packages/kernel). */
export const GET = async () => {
  return new Response(
    createReadStream('./node_modules/@tscad/kernel/kernel.wasm') as unknown as BodyInit,
    { headers: { 'content-type': 'application/wasm' } },
  );
};
