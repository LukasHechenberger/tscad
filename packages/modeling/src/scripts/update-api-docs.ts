import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DocDeclarationReference, DocNodeKind, ExcerptKind, TSDocParser } from '@microsoft/tsdoc';
import { DocExcerpt, DocNode } from '@microsoft/tsdoc';
import slugify from 'slugify';
import { Node, Project, SyntaxKind, TypeFormatFlags } from 'ts-morph';
import type { TypeNode } from '/Users/lukas/Documents/ls-age/projects/tscad/node_modules/.pnpm/fumadocs-ui@16.0.11_@types+react-dom@19.2.3_@types+react@19.2.4__@types+react@19.2.4_lu_e32d3c43b48130c6b05bd33213283fe7/node_modules/fumadocs-ui/dist/components/type-table.d.ts';

const baseSourceUrl = 'https://github.com/LukasHechenberger/tscad/tree/main/packages/modeling';

/** This is a simplistic solution until we implement proper DocNode rendering APIs. */
class Formatter {
  public static renderDocNode(documentNode: DocNode): string {
    let result: string = '';
    if (documentNode) {
      if (documentNode instanceof DocExcerpt) {
        result += documentNode.content.toString();
      }

      if (documentNode.kind === DocNodeKind.LinkTag) {
        // const content = this.renderDocNodes(documentNode.getChildNodes());

        let title: string | undefined = undefined;
        let target: string | undefined = undefined;

        for (const childNode of documentNode.getChildNodes()) {
          const text = Formatter.renderDocNode(childNode);

          // console.dir({
          //   text,
          //   kind: childNode.kind,
          //   excerptKind: childNode instanceof DocExcerpt ? childNode.excerptKind : undefined,
          // });

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

async function updateApiDocs() {
  console.time('create project');
  const project = new Project({
    tsConfigFilePath: 'tsconfig.json',
    // skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: true,
    skipFileDependencyResolution: true,
  });
  console.timeEnd('create project');

  const sourceFiles = project.getSourceFiles('src/**/*.ts');
  const exportedModules = sourceFiles.filter((sourceFile) =>
    sourceFile.getFilePath().endsWith('/index.ts'),
  );

  for (const sourceFile of exportedModules) {
    const moduleNameComponents = path
      .relative('src', path.dirname(sourceFile.getFilePath()))
      .split('/')
      .filter(Boolean);

    const docsPath = path.join(
      process.cwd(),
      '../../apps/docs/content/docs/api/modeling',
      moduleNameComponents.join('/'),
      'index.mdx',
    );

    const moduleName = ['@tscad/modeling', ...moduleNameComponents].join('/');
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

        // Ensure the statement is exported
        const title = statement.isKind(SyntaxKind.FunctionDeclaration)
          ? statement.getName() || 'anonymous'
          : statement.isKind(SyntaxKind.InterfaceDeclaration)
            ? statement.getName()
            : `\`${statement.getKindName()}\``;

        const description = Formatter.renderDocNode(
          parserContext.docComment.summarySection,
        )?.trim();
        const slug = parserContext.docComment.modifierTagSet.isPackageDocumentation()
          ? '@index'
          : slugGenerator.generate(title);

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

${
  exportedItems.length > 0
    ? `**Import**

\`\`\`ts
import { ${exportedItems.map((index) => index.title).join(', ')} } from '${moduleName}';
\`\`\``
    : ''
}

${exportedItems
  .map((item) => {
    let fullTitle = item.title;

    const details = [] as { title: string; text: string }[];
    if (Node.isFunctionDeclaration(item.statement)) {
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

      fullTitle = `${item.title}(${parameters.map((p) => p.title).join(', ')})`;

      details.push({
        title: `Parameters [!toc] [#${slugGenerator.generate(`${item.slug} parameters`)}] `,
        text: `<TypeTable type={${JSON.stringify(
          {
            ...Object.fromEntries(
              parameters.map((p, index) => [
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
      `## ${fullTitle} [#${item.slug}]`,
      item.description,

      ...details.map(
        (d) => `### ${d.title}
        
${d.text}`,
      ),

      `<small>
      
> [Defined in ${relativeSourcePath}:${item.source.line}](${new URL(`${relativeSourcePath}#L${item.source.line}`, `${baseSourceUrl}/`)})
 
</small>`,

      // FIXME: Remove
      `{/* kind:${item.statement.getKindName()} */}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  })
  .join('\n\n')}

<details>

\`\`\`json
${
  // FIXME: Remove
  JSON.stringify(
    {
      moduleName,
      description,
      exportedItems: exportedItems.map((item) => ({
        ...item,
        statement: undefined,
        parserContext: undefined,
      })),
    },
    undefined,
    2,
  )
}
\`\`\`

</details>

`;

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
}

updateApiDocs().catch((error) => {
  console.error(error);
  process.exit(1);
});
