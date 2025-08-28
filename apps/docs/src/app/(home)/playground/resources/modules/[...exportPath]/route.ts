import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const dynamic = 'force-static';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ exportPath: string[] }> },
) {
  const { exportPath } = await params;
  const resolvedPath = require.resolve(`@tscad/${exportPath.join('/')}`);
  console.log({ resolvedPath });

  return new Response(createReadStream(resolvedPath) as unknown as BodyInit);
}
