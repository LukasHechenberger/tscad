import { createReadStream } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET(_, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  return new Response(
    createReadStream(
      path.join(`./node_modules/@tscad/modeling/out/standalone/jscad/${name}.js`),
    ) as unknown as BodyInit,
    {},
  );
}
