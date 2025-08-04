import { createReadStream } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(
    createReadStream(
      path.join(`./node_modules/@tscad/modeling/out/standalone/primitives/index.js`),
    ) as unknown as BodyInit,
    {},
  );
}
