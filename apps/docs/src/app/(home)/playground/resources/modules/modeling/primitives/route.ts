import { createReadStream } from 'node:fs';
import path from 'node:path';

export async function GET() {
  return new Response(
    createReadStream(
      path.join(`./node_modules/@tscad/modeling/out/standalone/index.js`),
    ) as unknown as BodyInit,
    {},
  );
}
