import { createReadStream } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ path: ['@tsdoc/modeling/primitives'] }];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_, { params }: { params: Promise<{ path?: string[] }> }) {
  return new Response(
    createReadStream(
      path.join(`./node_modules/@tscad/modeling/out/standalone/index.js`),
    ) as unknown as BodyInit,
    {},
  );
}
