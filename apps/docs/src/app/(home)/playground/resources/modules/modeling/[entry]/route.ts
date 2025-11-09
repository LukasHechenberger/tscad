import { createReadStream } from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

export async function GET(_: Request, { params }: { params: Promise<{ entry: string }> }) {
  const { entry: entryName } = await params;

  const filePath = entryName.endsWith('.js') ? entryName : `${entryName}/index.js`;

  return new Response(
    createReadStream(
      path.join(`./node_modules/@tscad/modeling/out/standalone/${filePath}`),
    ) as unknown as BodyInit,
  );
}
