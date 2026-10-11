/**
 * Generates the API reference for the docs site from TSDoc: for each module (`@tscad/modeling`
 * with the built plugin packages, `@tscad/plugin-sdk`), an overview and one MDX page per
 * category. Modeling examples are rendered to SVGs by the kernel.
 *
 *   build-api-docs   # → apps/docs/content/docs/api/modules/<module>, apps/docs/public/reference
 *
 * The output is generated (and git-ignored): edit the TSDoc in the sources instead.
 */
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { runExample } from './examples';
import { API_MODULES, extractDocs, ROOT, type ReferenceEntry } from './extract';
import { docsKernel, renderSvg } from './render';

/** A package in the reference: the TSDoc of its exports, one page per `@category`. */
export type ReferenceModule = {
  /** The package name, the section's title. */
  name: string;
  /** The section's folder, under api/modules and public/reference. */
  slug: string;
  /** The source files whose exports are documented. */
  entries: () => string[];
  /** Categories in reading order, with each page's description. */
  categories: Record<string, string>;
  /** The section's overview page, above the cards for its categories. */
  overview: { description: string; text: string };
  /** Whether `@example`s are models, run and rendered (otherwise they are shown as code). */
  renderExamples: boolean;
  /** Where the documentation comes from, for the notice in generated pages. */
  source: string;
};

export const MODULES: ReferenceModule[] = [
  {
    name: '@tscad/modeling',
    slug: 'modeling',
    entries: () => API_MODULES.map((module) => module.entry),
    categories: {
      '3D shapes': 'Solids to start from: boxes, spheres, cylinders and cones.',
      '2D shapes': 'Shapes in the XY plane, to extrude into solids.',
      Extrusions: 'Turning 2D shapes into solids.',
      Transforms: 'Moving, turning, mirroring, scaling and coloring shapes.',
      Booleans: 'Combining solids: union, difference and intersection.',
      Parameters: "Models with parameters, for the preview's form and the CLI.",
      Plugins: 'Operations implemented by WebAssembly plugins.',
      Types: 'Vectors and the shape classes the functions return.',
    },
    overview: {
      description: 'OpenSCAD-style modeling in TypeScript',
      text: 'Models are TypeScript: function names follow OpenSCAD, but vectors and options are objects, so every number says what it is. Every picture is rendered by the kernel from the example next to it.',
    },
    renderExamples: true,
    source: 'the TSDoc in packages/modeling and the plugin packages',
  },
  {
    name: '@tscad/plugin-sdk',
    slug: 'plugin-sdk',
    entries: () => [path.join(ROOT, 'packages/plugin-sdk/src/index.ts')],
    categories: {
      Building: 'Turning a plugin package and its Rust crate into what tscad loads.',
      'Code generation':
        "The options WIT and TypeScript generated from a plugin's Rust options struct.",
    },
    overview: {
      description: 'Build tscad plugins',
      text: [
        'What plugins are built with. It ships `wit/tscad-plugin.wit`, the hand-written plugin interface a plugin crate implements (wit-bindgen generates the Rust bindings from it), and the `tscad-plugin` command. See [Writing a plugin](/docs/guides/plugins#writing-a-plugin) for a walkthrough.',
        '```sh\ntscad-plugin build [directory]\n```',
        "Builds the plugin package in `directory` (default: the current one) with `buildPlugin`. For a plugin with options, it also generates a second WIT, the plugin's options as a record, from its Rust options struct, and the package's typed exports from that. The functions below are its building blocks, for build tools of your own.",
      ].join('\n\n'),
    },
    renderExamples: false,
    source: 'the TSDoc in packages/plugin-sdk',
  },
];

export type Output = { contentDir: string; publicDir: string; imageUrl: string };

/** Where a module's pages and pictures go on the docs site. */
export function siteOutput(module: ReferenceModule): Output {
  return {
    contentDir: path.join(ROOT, 'apps/docs/content/docs/api/modules', module.slug),
    publicDir: path.join(ROOT, 'apps/docs/public/reference', module.slug),
    imageUrl: `/reference/${module.slug}`,
  };
}

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
  context: Awaited<ReturnType<typeof docsKernel>> | undefined,
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
    if (!context) {
      parts.push(fence(example));
      continue;
    }
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
        console.warn(
          `${entry.name}: no picture (${message}); build the plugins (bun run build --filter='./plugins/*')`,
        );
        parts.push(`<Example>\n\n${fence(code)}\n\n</Example>`);
      }
    }
  }
  return parts.join('\n\n');
}

export async function generateApiDocs(
  module: ReferenceModule,
  output: Output = siteOutput(module),
): Promise<number> {
  for (const directory of [output.contentDir, output.publicDir]) {
    rmSync(directory, { recursive: true, force: true });
    mkdirSync(directory, { recursive: true });
  }
  const entries = extractDocs(module.entries());
  const categories = [
    ...new Set([...Object.keys(module.categories), ...entries.map((entry) => entry.category)]),
  ].filter((category) => entries.some((entry) => entry.category === category));
  const base = `/docs/${output.contentDir.split('/content/docs/')[1]!}`;
  const links = new Map(
    entries.map((entry) => [
      entry.name,
      `${base}/${slug(entry.category)}#${entry.name.toLowerCase()}`,
    ]),
  );
  const context = module.renderExamples ? await docsKernel() : undefined;

  for (const category of categories) {
    const sections: string[] = [];
    for (const entry of entries.filter((candidate) => candidate.category === category))
      sections.push(await entryMdx(entry, links, output, context));
    const description = module.categories[category];
    const frontmatter = [
      '---',
      `title: ${category}`,
      ...(description ? [`description: ${JSON.stringify(description)}`] : []),
      '---',
    ].join('\n');
    const notice = `{/* Generated by build-api-docs (packages/scripts) from ${module.source}. Edit the source, not this file. */}`;
    await Bun.write(
      path.join(output.contentDir, `${slug(category)}.mdx`),
      `${frontmatter}\n\n${notice}\n\n${sections.join('\n\n')}\n`,
    );
  }
  await Bun.write(
    path.join(output.contentDir, 'meta.json'),
    `${JSON.stringify({ title: module.name, pages: ['index', ...categories.map((category) => slug(category))] }, undefined, 2)}\n`,
  );
  const cards = categories.map(
    (category) =>
      `  <Card title="${category}" href="${base}/${slug(category)}">${module.categories[category] ?? ''}</Card>`,
  );
  await Bun.write(
    path.join(output.contentDir, 'index.mdx'),
    `---\ntitle: Overview\ndescription: ${JSON.stringify(module.overview.description)}\n---\n\n${module.overview.text}\n\n<Cards>\n${cards.join('\n')}\n</Cards>\n`,
  );
  return entries.length;
}
