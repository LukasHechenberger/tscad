#!/usr/bin/env node
/* eslint-disable no-console */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DocDeclarationReference, DocNodeKind, ExcerptKind, TSDocParser } from '@microsoft/tsdoc';
import { DocExcerpt, DocNode } from '@microsoft/tsdoc';
import type { TypeNode } from 'fumadocs-ui/components/type-table';
import slugify from 'slugify';
import {
  type ImplementedKindToNodeMappings,
  Node,
  Project,
  SyntaxKind,
  TypeFormatFlags,
} from 'ts-morph';

/** This is a simplistic solution until we implement proper DocNode rendering APIs. */
class Formatter {
  public static renderDocNode(documentNode: DocNode): string {
    let result: string = '';
    if (documentNode) {
      if (documentNode instanceof DocExcerpt) {
        result += documentNode.content.toString();
      }

      if (documentNode.kind === DocNodeKind.LinkTag) {
        let title: string | undefined = undefined;
        let target: string | undefined = undefined;

        for (const childNode of documentNode.getChildNodes()) {
          const text = Formatter.renderDocNode(childNode);

          if (childNode instanceof DocExcerpt) {
            if (childNode.excerptKind === ExcerptKind.LinkTag_UrlDestination) {
              target = text;
            } else if (childNode.excerptKind === ExcerptKind.LinkTag_LinkText) {
              title = text;
            } else if (text.trim().length > 0) {
              console.warn(`Ignoring exerpt`, { kind: childNode.excerptKind, text });
            }
          } else if (childNode instanceof DocDeclarationReference) {
            title = text;

            if (childNode.packageName) {
              console.warn('External package link', childNode.packageName);
            } else {
              target = `#${text}`;
            }
            // target = text;
          } else {
            console.warn(`Unsupported child node kind in LinkTag: ${childNode.kind}`);
          }
        }

        if (!target) {
          console.warn(`LinkTag is missing a target: ${title}`);

          return `${title}`;
        }

        return `[${title}](${target})`;
      }

      for (const childNode of documentNode.getChildNodes()) {
        result += Formatter.renderDocNode(childNode);
      }
    }
    return result;
  }

  public static renderDocNodes(documentNodes: ReadonlyArray<DocNode>): string {
    let result: string = '';
    for (const documentNode of documentNodes) {
      result += Formatter.renderDocNode(documentNode);
    }
    return result;
  }
}

const slugGenerator = {
  usedSlugs: new Set<string>(),
  generate(text: string): string {
    const slug = slugify(text, { lower: true, strict: true });

    let uniqueSlug = slug;
    let counter = 1;

    while (this.usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    this.usedSlugs.add(uniqueSlug);
    return uniqueSlug;
  },
};

console.time('build api docs');
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const pathInRepository = manifest.repository.directory;
const pathInPackagesDirectory = path.relative('packages', pathInRepository);

const baseSourceUrl = new URL(
  pathInRepository,
  'https://github.com/LukasHechenberger/tscad/tree/main/',
).toString();

console.log(`Building API docs for ${manifest.name}...`);

console.time('create project');
const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
  // skipAddingFilesFromTsConfig: true,
  skipLoadingLibFiles: true,
  skipFileDependencyResolution: true,
});
console.timeEnd('create project');

const sourceFiles = project.getSourceFiles('src/**/*.ts');
// TODO [>=1.0.0]: Get from manifest exports
const exportedModules = sourceFiles
  .filter((sourceFile) => sourceFile.getFilePath().endsWith('/index.ts'))
  .map((sourceFile, _, all) => ({
    sourceFile,
    hasChildPage: all.some(
      (f) =>
        f !== sourceFile &&
        f.getFilePath().includes(sourceFile.getFilePath().replace('index.ts', '')),
    ),
  }));

for (const { sourceFile, hasChildPage } of exportedModules) {
  const moduleNameComponents = path
    .relative('src', path.dirname(sourceFile.getFilePath()))
    .split('/')
    .filter(Boolean);

  const docsFilename =
    moduleNameComponents.length === 0 && !hasChildPage
      ? `${pathInPackagesDirectory}.mdx`
      : path.join(
          pathInPackagesDirectory,
          `${moduleNameComponents.join('/')}${hasChildPage ? '/index.mdx' : '.mdx'}`,
        );

  const docsPath = path.join(
    process.cwd(),
    '../../apps/docs/content/docs/api/modules/',
    docsFilename,
  );

  const moduleName = [manifest.name, ...moduleNameComponents].join('/');
  const title = moduleNameComponents.length > 0 ? moduleNameComponents.at(-1) : moduleName;

  console.log(`DOC ${title}`);

  const commentedItems = sourceFile.getStatementsWithComments().flatMap((statement) => {
    return statement.getLeadingCommentRanges().flatMap((range) => {
      const text = range.getText();
      const parserContext = new TSDocParser().parseString(text);

      if (parserContext.log.messages.length > 0) {
        console.warn(`DOC   - Warning: TSDoc parse issues in ${moduleName}`);
        console.warn(parserContext.log.messages.map((message) => message.text).join('\n'));
      }

      const isPackageDocumentation =
        parserContext.docComment.modifierTagSet.isPackageDocumentation();

      // TODO [>=1.0.0]: Ensure the statement is exported

      const { title, name } = (
        {
          [SyntaxKind.FunctionDeclaration]: (s) => ({
            title: `function ${s.getName()}`,
            name: s.getName(),
          }),
          [SyntaxKind.InterfaceDeclaration]: (s) => ({
            title: `interface ${s.getName()}`,
            name: s.getName(),
          }),
          [SyntaxKind.ClassDeclaration]: (s) => ({
            title: `class ${s.getName()}`,
            name: s.getName(),
          }),
          [SyntaxKind.VariableStatement]: (s) => ({
            title: `const ${s.getDeclarations()[0]!.getName()}: ${s.getType().getText(undefined, TypeFormatFlags.NoTypeReduction)}`,
            name: s.getDeclarations()[0]!.getName(),
          }),
          [SyntaxKind.TypeAliasDeclaration]: (s) => ({
            title: `type ${s.getName()}`,
            name: s.getNameNode().getText(),
          }),
        } as {
          [K in SyntaxKind]?: (
            s: K extends keyof ImplementedKindToNodeMappings
              ? ImplementedKindToNodeMappings[K]
              : never,
          ) => {
            title: string;
            name: string;
          };
        }
      )[statement.getKind()]?.(statement as never) ?? {
        title: `unknown ${(statement as { getName?: () => string }).getName?.()}: ${statement.getKindName()}`,
        name: statement.getKindName(),
      };

      const description =
        Formatter.renderDocNode(parserContext.docComment.summarySection)?.trim() ||
        '*no description*';
      const slug = parserContext.docComment.modifierTagSet.isPackageDocumentation()
        ? '@index'
        : slugGenerator.generate(name);

      console.log(`DOC      - ${title}: ${description} [${slug}]`);

      return [
        {
          statement,
          parserContext,
          source: {
            line: statement.getStartLineNumber(),
          },
          kind: statement.getKindName(),
          title,
          name,
          slug,
          description,
          text,
          isPackageDocumentation,
          isType:
            statement.isKind(SyntaxKind.InterfaceDeclaration) ||
            statement.isKind(SyntaxKind.TypeAliasDeclaration),
        },
      ];
    });
  });

  const packageDocumentation = commentedItems.find((item) => item.isPackageDocumentation);
  if (!packageDocumentation)
    console.warn(`DOC   - WARNING: No package documentation found in ${moduleName}`);

  const description = packageDocumentation?.description.trim() ?? '';

  // Find exported functions
  const exportedItems = commentedItems

    // Order types last
    .sort((a, b) => {
      if (a.isType && !b.isType) return 1;
      if (!a.isType && b.isType) return -1;

      return 0;
    })
    .filter((item) => item !== packageDocumentation);

  console.log(`DOC  - Found ${exportedItems.length} exported items`);

  const content = `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(description)}
---

import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

${
  packageDocumentation && packageDocumentation.parserContext.docComment.remarksBlock
    ? Formatter.renderDocNode(
        packageDocumentation.parserContext.docComment.remarksBlock.content,
      )?.trim()
    : ''
}

---

## Methods and Properties [#@methods-and-props]

${
  exportedItems.length > 0
    ? `\`\`\`ts title="Import"
import { ${exportedItems.map((index) => `${index.isType ? 'type ' : ''}${index.name}`).join(', ')} } from '${moduleName}';
\`\`\``
    : ''
}

${exportedItems
  .map((item) => {
    let fullTitle = item.title;

    const details = [] as { title: string; text: string }[];
    if (Node.isFunctionDeclaration(item.statement)) {
      // Collect examples
      const exampleBlocks = item.parserContext.docComment.customBlocks.filter(
        (block) => block.blockTag.tagName === '@example',
      );

      const examples = [] as { title: string; text: string }[];
      for (const block of exampleBlocks) {
        if (block.content.nodes.length === 0) continue;

        const exampleTitle =
          Formatter.renderDocNode(block.content.nodes[0]!).trim() ||
          `Example ${examples.length + 1}`;

        examples.push({
          title: exampleTitle,
          text: Formatter.renderDocNodes(block.content.nodes.slice(1)).trim(),
        });
      }

      if (examples.length > 0) {
        details.push({
          title: `Examples`,
          text: `<Tabs items={${JSON.stringify(examples.map((ex) => ex.title))}}>
${examples
  .map(
    (example) => `<Tab>

${example.text}

</Tab>`,
  )
  .join('\n\n')}
</Tabs>`,
        });
      }

      // Collect parameters
      const parameters = [] as {
        name: string;
        title: string;
        description: string;
        type: string;
        optional: boolean;
      }[];

      const parameterStatements = item.statement.getParameters();
      const parameterDocs = item.parserContext.docComment.params;

      for (const parameter of parameterStatements) {
        const parameterName = parameter.getName();
        const optional = parameter.isOptional();

        const docs = parameterDocs.tryGetBlockByName(parameterName);

        const description = docs?.content
          ? Formatter.renderDocNodes(docs.content.getChildNodes())
          : undefined;
        if (!description) {
          console.warn(
            `DOC   - WARNING: No description for parameter "${parameterName}" in function "${item.title}"`,
          );
        }

        parameters.push({
          optional,
          name: parameterName,
          description: description || '*no description*',
          title: `${parameterName}${optional ? '?' : ''}`,
          type: `${parameter.getType().getText(undefined, TypeFormatFlags.NoTypeReduction)}`,
        });
      }

      const arguments_ = parameters.map((p) => p.title).join(', ');
      fullTitle = `${item.title}(${arguments_.length > 12 ? `...args` : arguments_})`;

      details.push({
        title: `Parameters`,
        text: `<TypeTable type={${JSON.stringify(
          {
            ...Object.fromEntries(
              parameters.map((p) => [
                p.name,
                {
                  description: p.description,
                  type: p.type,
                  // typeDescription: p.typeDescription,
                  required: !p.optional,
                  // parameters: [{ name: 'string', description: 'asdf' }],
                } satisfies TypeNode,
              ]),
            ),
          },
          undefined,
          2,
        )}} />`,
      });
    }

    const relativeSourcePath = path.relative(process.cwd(), sourceFile.getFilePath());

    return [
      `### \`${fullTitle}{:ts}\` [#${item.slug}]`,

      item.description,

      ...details.map(
        (d) => `**${d.title.trim()}**
        
${d.text}`,
      ),

      `<small>
      
> [Defined in ${relativeSourcePath}:${item.source.line}](${new URL(`${relativeSourcePath}#L${item.source.line}`, `${baseSourceUrl}/`)})
 
</small>`,
    ]
      .filter(Boolean)
      .join('\n\n');
  })
  .join('\n\n')}

${
  moduleNameComponents.length > 0
    ? ''
    : `## Changelog
${(
  await readFile(
    path.relative(process.cwd(), path.join('../../', pathInRepository, './CHANGELOG.md')),
    'utf8',
  ).catch(() => '*no changelog so far*')
)
  // eslint-disable-next-line unicorn/no-await-expression-member
  .trim()
  .split('\n')
  .slice(1)
  .join('\n')
  .replaceAll(
    /^##\s+(.+)/gm,
    (_, p1) => `## ${p1} [#${slugGenerator.generate(`changelog ${p1.replace('.', ' ')}`)}]`,
  )
  .replaceAll(/^###\s+(.+)/gm, '**$1**')
  .replaceAll(/^#/gm, '##')}`
}

`; // FIXME [>=1.0.0]: Add submodules section

  if (!packageDocumentation && exportedItems.length === 0) {
    console.info(
      `Removing ${path.relative(process.cwd(), docsPath)} because there are no exported items`,
    );
    await rm(docsPath).catch(() => {});
  } else {
    console.info(`Writing to ${path.relative(process.cwd(), docsPath)}\n`);
    await mkdir(path.dirname(docsPath), { recursive: true });
    await writeFile(docsPath, content);
  }
}

console.timeEnd('build api docs');
