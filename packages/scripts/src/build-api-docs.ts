#!/usr/bin/env node
/* eslint-disable no-console */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ApiClass,
  ApiDeclaredItem,
  ApiDocumentedItem,
  ApiFunction,
  ApiItem,
  ApiItemKind,
  ApiMethod,
  ApiModel,
  ApiPackage,
  ApiTypeAlias,
} from '@microsoft/api-extractor-model';
import {
  DocCodeSpan,
  DocDeclarationReference,
  DocFencedCode,
  DocHtmlStartTag,
  DocNodeKind,
  DocParagraph,
  DocPlainText,
  ExcerptKind,
} from '@microsoft/tsdoc';
import { DocExcerpt, DocNode } from '@microsoft/tsdoc';
import type { TypeNode } from 'fumadocs-ui/components/type-table';

/** This is a simplistic solution until we implement proper DocNode rendering APIs. */
class Formatter {
  public static renderDocNode(documentNode: DocNode | undefined): string {
    if (!documentNode) return '';
    let result: string = '';

    switch (documentNode.kind) {
      case DocNodeKind.LinkTag: {
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
      case DocNodeKind.Excerpt:
      case DocNodeKind.Section:
      case DocNodeKind.Paragraph: {
        // case DocNodeKind.BlockTag:
        return Formatter.renderDocNodes((documentNode as DocParagraph).getChildNodes());
      }
      case DocNodeKind.BlockTag: {
        // These are just '@remarks' etc.
        return '';
      }
      case DocNodeKind.PlainText: {
        result += (documentNode as DocPlainText).text;
        break;
      }
      case DocNodeKind.CodeSpan: {
        const codespan = documentNode as DocCodeSpan;
        return `\`${codespan.code}\``;
      }
      case DocNodeKind.HtmlStartTag:
      case DocNodeKind.HtmlEndTag: {
        return (documentNode as DocHtmlStartTag).emitAsHtml();
      }
      case DocNodeKind.FencedCode: {
        const fenced = documentNode as DocFencedCode;

        return `\`\`\`${fenced.language}
${fenced.code}
\`\`\``;
      }
      case DocNodeKind.SoftBreak: {
        result += '\n\n';
        break;
      }
      default: {
        console.log(`Unsupported DocNode kind: ${documentNode.kind}`);
        result += `\`${documentNode.kind}\``;
      }
    }

    // for (const childNode of documentNode.getChildNodes()) {
    //   result += Formatter.renderDocNode(childNode);
    // }

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

// Configuration
const anchorOffeset = 24;

const inputReport = './temp/modeling.api.json';
const outputPath = '../../apps/docs/content/docs/api/modules/modeling/index.mdx';

const apiModel: ApiModel = new ApiModel();
const apiPackage: ApiPackage = apiModel.loadPackage(inputReport);
const apiManifest = await readFile('./package.json', 'utf8').then((data) => JSON.parse(data));

// TODO: Load other modules by calling
// apiModel.addMember(...)

type FormatterHandler = (item: any) => {
  title: string;
  shortTitle?: string;
  body?: string[];
};

class ApiItemFormatter {
  private handlers = {
    [ApiItemKind.Class]: (item: ApiClass) => {
      return {
        title: `\`class ${item.displayName}{:ts}\``,
        body: [
          `**Members**`,

          // TODO [>=1.0.0]: Probably use accordions to display member details

          // Overview
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
                      ? Formatter.renderDocNode(
                          (member as ApiDocumentedItem).tsdocComment?.summarySection,
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
                        Formatter.renderDocNode(parameter.tsdocParamBlock.content).trim();

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
  } satisfies Partial<Record<ApiItemKind, FormatterHandler>>;

  renderDocItem: FormatterHandler = (item: ApiItem) => {
    const handler =
      item.kind in this.handlers &&
      (this.handlers as Record<ApiItemKind, FormatterHandler>)[item.kind];

    if (handler) return handler(item);

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

for (const entryPoint of apiPackage.entryPoints) {
  const exportedMembers = entryPoint.members;
  const fullImportName = path.join(apiPackage.name, entryPoint.importPath ?? '');
  const sourceUrl = new URL(
    path.join('blob/main', apiManifest.repository.directory),
    `${apiManifest.repository.url.replace(/^git\+/, '').replace(/\.git$/, '')}/`,
  );

  console.log(`Entry point: ${fullImportName}`);
  console.log(`Source URL: ${sourceUrl.toString()}`);
  const itemSourceUrl = (item: ApiDeclaredItem) =>
    new URL(item.fileUrlPath!, `${sourceUrl}/`).toString();

  const description = Formatter.renderDocNodes(
    apiPackage.tsdocComment?.summarySection?.getChildNodes() ?? [],
  );

  await writeFile(
    outputPath,
    /* mdx */ `
---
title: ${JSON.stringify(apiPackage.name)}
description: ${JSON.stringify(description)}
---

import { CodeIcon } from 'lucide-react';
import { TypeTable } from 'fumadocs-ui/components/type-table';

{/* Remarks */}

${Formatter.renderDocNodes(apiPackage.tsdocComment?.remarksBlock?.getChildNodes() ?? [])}

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
    const info = {};
    member.serializeInto(info);

    return [
      // Anchor
      `<div className="pt-${anchorOffeset} -mt-${anchorOffeset}" id="${encodeURIComponent(member.getScopedNameWithinPackage())}" />`,

      '<div className="hidden">',
      `### ${rendered.shortTitle ?? rendered.title} [#${encodeURIComponent(member.getScopedNameWithinPackage())}]`,
      '</div>',
      `<h3>`,
      rendered.title,
      '</h3>',

      // Summary
      ...(declaredItem?.tsdocComment
        ? [Formatter.renderDocNode(declaredItem.tsdocComment.summarySection).trim()]
        : []),

      // Remarks
      ...(declaredItem?.tsdocComment?.remarksBlock
        ? [
            '**Remarks**',
            Formatter.renderDocNode(declaredItem.tsdocComment.remarksBlock?.content).trim(),
            // NOTE: Uncomment to enable blockquote style for remarks
            // .replaceAll(/^/gm, '> '),
          ]
        : []),

      ...(rendered.body ?? []),
      declaredItem &&
        `<small>
      
> Defined in [${path.join(apiManifest.repository.directory, declaredItem.fileUrlPath!)}](${itemSourceUrl(declaredItem)})
 
</small>`,
    ];
  })
  .filter(Boolean)
  .join('\n\n')}
  
`.trim(),
  );
}
