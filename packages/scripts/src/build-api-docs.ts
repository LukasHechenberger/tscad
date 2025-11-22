#!/usr/bin/env node
/* eslint-disable no-console */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { styleText } from 'node:util';
import { Extractor, ExtractorConfig, ExtractorResult } from '@microsoft/api-extractor';
import {
  ApiClass,
  ApiDeclaredItem,
  ApiDocumentedItem,
  ApiFunction,
  ApiInterface,
  ApiItem,
  ApiItemKind,
  ApiMethod,
  ApiModel,
  ApiProperty,
  ApiTypeAlias,
  ApiVariable,
} from '@microsoft/api-extractor-model';
import { DocNodeKind, DocParagraph } from '@microsoft/tsdoc';
import type { TypeNode } from 'fumadocs-ui/components/type-table';
import { MarkdownRenderer } from './lib/formatter';

// Load package manifest
const packageJson = await readFile('./package.json', 'utf8').then((data) => JSON.parse(data));
const unscopedPackageName = packageJson.name.replace(/^@.*\//, '');

const sourceUrl = new URL(
  path.join('blob/main', packageJson.repository.directory),
  `${packageJson.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')}/`,
);

const entryFiles = (Object.entries(packageJson.exports) as [string, { types: string }][]).map(
  ([key, exp]) => {
    const name = key.slice(2) || 'index';
    return {
      name,
      actualImportName: name === 'index' ? packageJson.name : `${packageJson.name}/${name}`,
      extractorModuleName: name === 'index' ? packageJson.name : `${packageJson.name}--${name}`,
      dts: exp.types,
    };
  },
);

const apiModel: ApiModel = new ApiModel();

// run API Extractor for all entry files
for (const entryFile of entryFiles) {
  console.log(styleText(['cyan', 'bold'], `Processing entry file: ${entryFile.dts}\n`));
  const inputReport = `etc/${entryFile.name}.api.json`;

  const extractorConfig: ExtractorConfig = ExtractorConfig.prepare({
    configObject: {
      mainEntryPointFilePath: path.join(process.cwd(), entryFile.dts),
      projectFolder: process.cwd(),

      compiler: {
        tsconfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
      },
      docModel: {
        enabled: true,
        apiJsonFilePath: `<projectFolder>/${inputReport}`,
        // projectFolderUrl: sourceUrl.toString(),
      },
      apiReport: {
        enabled: true,
        reportFolder: '<projectFolder>/etc/',
        reportFileName: `${entryFile.name}`,
        reportTempFolder: '<projectFolder>/temp/',
      },
    },

    packageJson,
    packageJsonFullPath: path.join(process.cwd(), 'package.json'),
    configObjectFullPath: path.join(process.cwd(), 'does-not-exist/api-extractor.json'),
  });

  // Invoke API Extractor
  const extractorResult: ExtractorResult = Extractor.invoke(extractorConfig, {
    // Equivalent to the "--local" command-line parameter
    localBuild: true,

    // Equivalent to the "--verbose" command-line parameter
    showVerboseMessages: true,
  });

  if (extractorResult.succeeded) {
    console.log(
      styleText(
        ['green', 'bold'],
        `
API Extractor completed successfully
`,
      ),
    );

    // NOTE: As API Extractor currently only supports a single entry point per package,
    // we need to adjust the package name for non-index entry points
    if (entryFile.name !== 'index') {
      const raw = await readFile(inputReport, 'utf8');
      const updated = raw.replaceAll(packageJson.name, `${packageJson.name}--${entryFile.name}`);
      await writeFile(inputReport, updated, 'utf8');
    }

    apiModel.loadPackage(inputReport);
  } else {
    console.error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`,
    );
    console.dir(extractorResult.compilerState, { depth: 5 });
    process.exitCode = 1;
  }
}

if (process.exitCode === 1) {
  console.error(styleText(['red', 'bold'], 'API extraction failed, see errors above'));
  process.exit(process.exitCode);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormatterHandler = (item: any) => {
  title: string;
  shortTitle?: string;
  body?: string[];
};

const markdownRenderer = new MarkdownRenderer(apiModel);

class ApiItemFormatter {
  private handlers = {
    [ApiItemKind.Class]: (item: ApiClass) => {
      return {
        title: `\`class ${item.displayName}{:ts}\``,
        body: [
          `**Members**`,

          // TODO [>=1.0.0]: Probably use accordions to display member details

          `<TypeTable type={${JSON.stringify(
            Object.fromEntries(
              item.members.map((member) => {
                const prefixes = [
                  (member as ApiMethod).isProtected ? 'protected' : undefined,
                  (member as ApiMethod).isStatic ? 'static' : undefined,
                  (member as ApiMethod).isAbstract ? 'abstract' : undefined,
                ].filter(Boolean);
                const displayName = [...prefixes, member.displayName].join(' ');

                return [
                  `${displayName}`,
                  {
                    type: member.kind,
                    required: true,
                    typeDescription: (member as ApiMethod).excerpt.text.trim(),
                    description: (member as ApiDocumentedItem)?.tsdocComment?.summarySection
                      ? markdownRenderer.render(
                          (member as ApiDocumentedItem).tsdocComment?.summarySection,
                          member,
                        )
                      : undefined,
                  } satisfies TypeNode,
                ];
              }),
            ),
          )}} />`,
        ],
      };
    },
    [ApiItemKind.Function]: (item: ApiFunction) => {
      const parametersTitle = item.parameters
        .map((parameter) => `${parameter.name}${parameter.isOptional ? '?' : ''}`)
        .join(', ');

      return {
        title: `\`function ${item.displayName}(${parametersTitle}){:ts}\``,
        shortTitle: `\`function ${item.displayName}{:ts}\``,

        body: [
          ...(item.parameters.length > 0
            ? [
                `**Parameters**`,
                `<TypeTable type={${JSON.stringify(
                  Object.fromEntries(
                    item.parameters.map((parameter) => {
                      const description =
                        parameter.tsdocParamBlock &&
                        markdownRenderer.render(parameter.tsdocParamBlock.content, item).trim();

                      return [
                        parameter.name,
                        {
                          type: parameter.parameterTypeExcerpt.text.trim(),
                          required: !parameter.isOptional,
                          description,
                        } satisfies TypeNode,
                      ];
                    }),
                  ),
                  undefined,
                  2,
                )}} />`,
              ]
            : []),
        ],
      };
    },
    [ApiItemKind.TypeAlias]: (item: ApiTypeAlias) => {
      const typeParametersTitle =
        item.typeParameters.length > 0
          ? `<${item.typeParameters.map((parameter) => parameter.name).join(', ')}>`
          : '';
      return {
        title: `\`type ${item.displayName}{:ts}\``,
        // title: ,
        body: [
          '**Definition**',
          `\`\`\`ts
type ${item.displayName}${typeParametersTitle} = ${item.typeExcerpt.text}
\`\`\``,

          ...(item.members.map((member) => `- ${member.displayName}`) || []),
        ],
      };
    },
    [ApiItemKind.Interface]: (item: ApiInterface) => {
      return {
        title: `\`interface ${item.displayName}{:ts}\``,
        body: [
          '**Members**',

          `<TypeTable type={${JSON.stringify(
            Object.fromEntries(
              item.members.map((member) => {
                const prefixes = [
                  (member as ApiMethod).isProtected ? 'protected' : undefined,
                  (member as ApiMethod).isStatic ? 'static' : undefined,
                  (member as ApiMethod).isAbstract ? 'abstract' : undefined,
                ].filter(Boolean);
                const displayName = [...prefixes, member.displayName].join(' ');

                return [
                  `${displayName}`,
                  {
                    required: !(member as ApiMethod).isOptional,
                    type: (member as ApiProperty).propertyTypeExcerpt?.text.trim(),
                    description: (member as ApiDocumentedItem)?.tsdocComment?.summarySection
                      ? markdownRenderer.render(
                          (member as ApiDocumentedItem).tsdocComment?.summarySection,
                          member,
                        )
                      : undefined,
                  } satisfies TypeNode,
                ];
              }),
            ),
          )}} />`,
        ],
      };
    },
    [ApiItemKind.Variable]: (item: ApiVariable) => {
      return {
        title: `\`const ${item.displayName}: ${item.variableTypeExcerpt.text}{:ts}\``,
        shortTitle: `\`const ${item.displayName}{:ts}\``,

        body: [],
      };
    },
  } satisfies Partial<Record<ApiItemKind, FormatterHandler>>;

  renderDocItem: FormatterHandler = (item: ApiItem) => {
    const handler =
      item.kind in this.handlers &&
      (this.handlers as Partial<Record<ApiItemKind, FormatterHandler>>)[item.kind];

    if (handler) return handler(item);

    console.warn(styleText(['yellow', 'bold'], `⚠️  No handler for item kind: ${item.kind}`));
    process.exitCode = 1;

    return {
      title: `${item.displayName}`,
      body: [
        `<Callout>
  TODO: Implement rendering for \`${item.kind}\` items
</Callout>`,
      ],
    };
  };
}

const nodeHandler = new ApiItemFormatter();

for (const apiPackage of apiModel.packages) {
  const entryFile = entryFiles.find((ef) => ef.extractorModuleName === apiPackage.name);
  if (!entryFile) throw new Error(`Could not find entry file for package ${apiPackage.name}`);

  for (const entryPoint of apiPackage.entryPoints) {
    const outputPathInModulesDirectory =
      entryFiles.length > 1 ? `${unscopedPackageName}/${entryFile.name}` : unscopedPackageName;
    const outputPath = `../../apps/docs/content/docs/api/modules/${outputPathInModulesDirectory}.mdx`;
    const exportedMembers = entryPoint.members;
    const fullImportName = entryFile.actualImportName;

    // eslint-disable-next-line unicorn/consistent-function-scoping
    const itemSourceUrl = (item: ApiDeclaredItem) =>
      new URL(item.fileUrlPath!, `${sourceUrl}/`).toString();

    console.log(styleText(['cyan', 'bold'], `\nDocumenting entry point: ${fullImportName}`));

    const description = markdownRenderer.render(
      apiPackage.tsdocComment?.summarySection?.getChildNodes() ?? [],
      apiPackage,
    );

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(
      outputPath,
      /* mdx */ `
---
title: ${JSON.stringify(entryFile.name === 'index' ? entryFile.actualImportName : entryFile.name)}
description: ${JSON.stringify(description)}
---

import { CodeIcon } from 'lucide-react';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Anchor } from '@/components/anchor';

{/* Remarks */}

${markdownRenderer.render(apiPackage.tsdocComment?.remarksBlock ?? [], apiPackage)}

---

\`\`\`ts title="Import"
import { 
  ${exportedMembers.map((m) => `${m.kind === ApiItemKind.TypeAlias ? 'type ' : ''}${m.displayName}`).join(',\n  ')}
} from '${fullImportName}'
\`\`\`

## Methods and properties [#@methods-and-props]

${exportedMembers
  .flatMap((member) => {
    const rendered = nodeHandler.renderDocItem(member);
    const declaredItem = 'fileUrlPath' in member ? (member as ApiDeclaredItem) : undefined;

    const examples = declaredItem?.tsdocComment?.customBlocks
      .filter((block) => block.blockTag.tagName === '@example')
      .map((example, index) => {
        let title = '';

        const contentChildren = example.content.getChildNodes();

        // Use first paragraph as title if it exists
        if (contentChildren[0]?.kind === DocNodeKind.Paragraph) {
          title = markdownRenderer.render(contentChildren[0], member);
          (contentChildren[0] as DocParagraph).clearNodes();
        }

        return {
          title: title.trim() || `Example ${index + 1}`,
          content: example.content,
        };
      });

    const anchorId = encodeURIComponent(member.getScopedNameWithinPackage());

    return [
      // Anchor
      `<Anchor id="${anchorId}" />`,
      // Hidden title for TOC creation
      '<div className="hidden">',
      `### ${rendered.shortTitle ?? rendered.title} [#${anchorId}]`,
      '</div>',
      // Visible title
      `<h3>`,
      rendered.title,
      '</h3>',

      // Summary
      ...(declaredItem?.tsdocComment
        ? [markdownRenderer.render(declaredItem.tsdocComment.summarySection, member).trim()]
        : []),

      // Remarks
      ...(declaredItem?.tsdocComment?.remarksBlock
        ? [
            '**Remarks**',
            markdownRenderer.render(declaredItem.tsdocComment.remarksBlock?.content, member).trim(),
            // NOTE: Uncomment to enable blockquote style for remarks
            // .replaceAll(/^/gm, '> '),
          ]
        : []),

      // Examples
      ...(examples?.length
        ? [
            '**Examples**',
            `<Tabs items={${JSON.stringify(examples.map(({ title }) => title))}}>`,
            ...examples.map((exampleBlock) => {
              return `<Tab value="${exampleBlock.title}" title="${exampleBlock.title}">\n${markdownRenderer
                .render(exampleBlock.content, member)
                .trim()}\n</Tab>`;
            }),
            '</Tabs>',
          ]
        : []),

      ...(rendered.body ?? []),
      declaredItem &&
        `<small>
      
> Defined in [${path.join(packageJson.repository.directory, declaredItem.fileUrlPath!)}](${itemSourceUrl(declaredItem)})
 
</small>`,
    ];
  })
  .filter(Boolean)
  .join('\n\n')}
  
`.trim(),
    );

    console.log(styleText(['green', 'bold'], `\n👍 Wrote API docs to ${outputPath}`));
  }
}
