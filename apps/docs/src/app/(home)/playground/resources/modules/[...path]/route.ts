import { createReadStream } from 'fs';
import { join } from 'path';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ path: ['@tsdoc/modeling/primitives'] }];
}

export async function GET(_, { params }: { params: Promise<{ path?: string[] }> }) {
  return new Response(
    createReadStream(
      join(`./node_modules/@tscad/modeling/out/standalone/index.js`),
    ) as unknown as BodyInit,
    {},
  );
}
