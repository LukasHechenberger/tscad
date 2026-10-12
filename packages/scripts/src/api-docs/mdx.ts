/**
 * Generates the API reference for the docs site from the TSDoc of `@tscad/modeling` and the built
 * plugin packages: one MDX page per category, with every `@example` cell rendered to an SVG by the kernel.
 *
 *   build-api-docs   # → apps/docs/content/docs/api/modules/modeling, apps/docs/public/reference
 *
 * The output is generated (and git-ignored): edit the TSDoc in packages/modeling (or a plugin's
 * options struct) instead.
 */
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { runExample } from './examples';
import { CATEGORIES, extractDocs, ROOT, type ReferenceEntry } from './extract';
import { docsKernel, renderSvg } from './render';

/** Page description per category (others get none). */
const DESCRIPTIONS: Record<string, string> = {
  '3D shapes': 'Solids to start from: boxes, spheres, cylinders and cones.',
  '2D shapes': 'Shapes in the XY plane, to extrude into solids.',
  Extrusions: 'Turning 2D shapes into solids.',
  Transforms: 'Moving, turning, mirroring, scaling and coloring shapes.',
  Booleans: 'Combining solids: union, difference and intersection.',
  Parameters: "Models with parameters, for the preview's form and the CLI.",
  Plugins: 'Operations implemented by WebAssembly plugins.',
  Types: 'Vectors and the shape classes the functions return.',
};

export type Output = { contentDir: string; publicDir: string; imageUrl: string };

export const SITE: Output = {
  contentDir: path.join(ROOT, 'apps/docs/content/docs/api/modules/modeling'),
  publicDir: path.join(ROOT, 'apps/docs/public/reference/modeling'),
  imageUrl: '/reference/modeling',
};

const slug = (category: string) => category.toLowerCase().replaceAll(/\W+/g, '-');

/**
 * Comment text as MDX: `code` naming an entry links to it; braces and angle brackets outside
 * code are escaped, since MDX would read them as expressions and JSX.
 */
function prose(text: string, links: ReadonlyMap<string, string>): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part, index) => {
      if (index % 2 === 1) {
        const link = links.get(part.slice(1, -1));
        return link ? `[${part}](${link})` : part;
      }
      return part.replaceAll(/[{}]/g, String.raw`\$&`).replaceAll('<', '&lt;');
    })
    .join('')
    .replaceAll(/(?<!\n)[ \t]*\n[ \t]*(?!\n)/g, ' '); // re-flow lines, keep blank-line paragraphs
}

const fence = (code: string) => `\`\`\`ts\n${code}\n\`\`\``;

async function entryMdx(
  entry: ReferenceEntry,
  links: ReadonlyMap<string, string>,
  output: Output,
  context: Awaited<ReturnType<typeof docsKernel>>,
): Promise<string> {
  const parts = [`## ${entry.name}`, fence(entry.signature)];
  if (entry.documentation) parts.push(prose(entry.documentation, links));
  if (entry.options.length > 0) {
    const table = Object.fromEntries(
      entry.options.map((o) => [
        o.name,
        {
          type: o.type,
          description: prose(o.documentation, new Map()),
          required: !o.optional && !o.oneOf,
          ...(o.oneOf && { typeDescription: 'one of the alternatives' }),
        },
      ]),
    );
    parts.push(`<TypeTable type={${JSON.stringify(table)}} />`);
  }
  if (entry.members.length > 0)
    parts.push(
      `Methods (each one is the function of the same name, applied to this shape):`,
      fence(entry.members.join('\n')),
    );
  for (const [exampleIndex, example] of entry.examples.entries()) {
    const results = await runExample(example);
    for (const [cellIndex, { code, value }] of results.entries()) {
      const file = `${entry.name}-${exampleIndex + 1}-${cellIndex + 1}.svg`;
      try {
        await Bun.write(path.join(output.publicDir, file), await renderSvg(context, value));
        parts.push(`<Example image="${output.imageUrl}/${file}">\n\n${fence(code)}\n\n</Example>`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Plugins are optional build products; everything else is a broken example.
        if (!message.includes('was not expanded'))
          throw new Error(`${entry.name}, example ${exampleIndex + 1}: ${message}`);
        // eslint-disable-next-line no-console
        console.warn(`${entry.name}: no picture (${message}); build the plugins (@tscad/plugins)`);
        parts.push(`<Example>\n\n${fence(code)}\n\n</Example>`);
      }
    }
  }
  return parts.join('\n\n');
}

export async function generateApiDocs(output: Output = SITE): Promise<number> {
  for (const directory of [output.contentDir, output.publicDir]) {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
  }
  const entries = extractDocs();
  const categories = [
    ...new Set([...CATEGORIES, ...entries.map((entry) => entry.category)]),
  ].filter((category) => entries.some((entry) => entry.category === category));
  const base = `/docs/${output.contentDir.split('/content/docs/')[1]!}`;
  const links = new Map(
    entries.map((entry) => [
      entry.name,
      `${base}/${slug(entry.category)}#${entry.name.toLowerCase()}`,
    ]),
  );
  const context = await docsKernel();

  for (const category of categories) {
    const sections: string[] = [];
    for (const entry of entries.filter((candidate) => candidate.category === category))
      sections.push(await entryMdx(entry, links, output, context));
    const description = DESCRIPTIONS[category];
    const frontmatter = [
      '---',
      `title: ${category}`,
      ...(description ? [`description: ${JSON.stringify(description)}`] : []),
      '---',
    ].join('\n');
    const notice =
      '{/* Generated by build-api-docs (packages/scripts) from the TSDoc in packages/modeling and the plugin packages. Edit the source, not this file. */}';
    await Bun.write(
      path.join(output.contentDir, `${slug(category)}.mdx`),
      `${frontmatter}\n\n${notice}\n\n${sections.join('\n\n')}\n`,
    );
  }
  await Bun.write(
    path.join(output.contentDir, 'meta.json'),
    `${JSON.stringify({ title: '@tscad/modeling', pages: ['index', ...categories.map((category) => slug(category))] }, undefined, 2)}\n`,
  );
  const cards = categories.map(
    (category) =>
      `  <Card title="${category}" href="${base}/${slug(category)}">${DESCRIPTIONS[category] ?? ''}</Card>`,
  );
  await Bun.write(
    path.join(output.contentDir, 'index.mdx'),
    `---\ntitle: Overview\ndescription: "OpenSCAD-style modeling in TypeScript"\n---\n\nModels are TypeScript: function names follow OpenSCAD, but vectors and options are objects, so every number says what it is. Every picture is rendered by the kernel from the example next to it.\n\n<Cards>\n${cards.join('\n')}\n</Cards>\n`,
  );
  return entries.length;
}
