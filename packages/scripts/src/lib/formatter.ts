/* eslint-disable no-console */

import { styleText } from 'node:util';
import type { ApiItem, ApiModel } from '@microsoft/api-extractor-model';
import {
  DocBlock,
  DocBlockTag,
  DocCodeSpan,
  DocDeclarationReference,
  DocExcerpt,
  DocFencedCode,
  DocHtmlStartTag,
  DocLinkTag,
  DocNode,
  DocNodeContainer,
  DocNodeKind,
  DocPlainText,
  ExcerptKind,
} from '@microsoft/tsdoc';

abstract class Renderer<Kinds extends string | number> {
  protected abstract handlers: Partial<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [K in Kinds]: (node: any, contextApiItem: ApiItem) => string;
  }>;
}

abstract class TsdocRenderer extends Renderer<DocNodeKind> {
  constructor(protected readonly apiModel: ApiModel) {
    super();
  }

  /** Helper to render child nodes */
  protected renderChildNodes = (node: DocNodeContainer, contextApiItem: ApiItem) => {
    return this.render(node.getChildNodes(), contextApiItem);
  };

  public render(node: DocNode | readonly DocNode[] | undefined, contextApiItem: ApiItem): string;
  public render(node: DocNode | DocNode[] | undefined, contextApiItem: ApiItem): string {
    if (!node) return '';

    if (Array.isArray(node)) {
      return node.map((n) => this.render(n, contextApiItem)).join('');
    }

    const handler = this.handlers[node.kind as DocNodeKind];

    if (!handler) {
      console.log(
        styleText(
          ['yellow', 'bold'],
          `No ${this.constructor.name} handler for DocNode kind: ${node.kind}`,
        ),
      );
      process.exitCode = 1;
      return '';
    }

    return handler(node, contextApiItem);
  }
}

export class MarkdownRenderer extends TsdocRenderer {
  protected handlers = {
    [DocNodeKind.PlainText]: (node: DocPlainText) => node.text,
    [DocNodeKind.Paragraph]: this.renderChildNodes,
    [DocNodeKind.Section]: this.renderChildNodes,
    [DocNodeKind.Excerpt]: this.renderChildNodes,
    [DocNodeKind.SoftBreak]: () => '\n\n',
    [DocNodeKind.HtmlStartTag]: (node: DocHtmlStartTag) => node.emitAsHtml(),
    [DocNodeKind.HtmlEndTag]: (node: DocHtmlStartTag) => node.emitAsHtml(),
    [DocNodeKind.CodeSpan]: (node: DocCodeSpan) => `\`${node.code}\``,
    [DocNodeKind.LinkTag]: (node: DocLinkTag, contextApiItem: ApiItem) => {
      let title: string | undefined;
      let target: string | undefined;

      for (const childNode of node.getChildNodes()) {
        if (childNode.kind === DocNodeKind.Excerpt) {
          const text = super.render(childNode, contextApiItem); // use PlainTextRenderer

          const excerpt = childNode as DocExcerpt;
          if (excerpt.excerptKind === ExcerptKind.LinkTag_UrlDestination) {
            target = text;
          } else if (excerpt.excerptKind === ExcerptKind.LinkTag_LinkText) {
            title = text;
          } else if (text.trim().length > 0) {
            console.warn(`Ignoring exerpt`, { kind: excerpt.excerptKind, text });
          }
        } else if (childNode.kind === DocNodeKind.DeclarationReference) {
          const resolved = this.apiModel.resolveDeclarationReference(
            childNode as DocDeclarationReference,
            contextApiItem.getAssociatedPackage(),
          );

          if (resolved?.errorMessage || !resolved?.resolvedApiItem) {
            throw new Error(`Failed to resolve declaration reference: ${resolved.errorMessage}`);
          }

          title = resolved.resolvedApiItem.displayName;
          if (
            resolved.resolvedApiItem.getAssociatedPackage() !==
            contextApiItem.getAssociatedPackage()
          ) {
            throw new Error('External package links are not supported yet');
          }

          target = `#${encodeURIComponent(resolved.resolvedApiItem.getScopedNameWithinPackage())}`;
        } else {
          console.warn(`Unsupported child node kind in LinkTag: ${childNode.kind}`);
          process.exitCode = 1;
        }
      }

      if (!target) {
        console.warn(`LinkTag is missing a target: ${title}`);

        return `${title}`;
      }

      return `[${title}](${target})`;
    },
    [DocNodeKind.FencedCode]: (node: DocFencedCode) => {
      return `\`\`\`${node.language}\n${node.code}\n\`\`\``;
    },
    [DocNodeKind.Block]: (node: DocBlock, contextApiItem: ApiItem) => {
      const tag = node.blockTag;

      if (['@remarks', '@example'].includes(node.blockTag.tagName)) {
        return this.renderChildNodes(node.content, contextApiItem);
      }

      console.warn(styleText(['yellow'], `Unsupported DocBlock with tag: ${tag.tagName}`));
      process.exitCode = 1;
      return this.render(node.getChildNodes(), contextApiItem);
    },

    [DocNodeKind.BlockTag]: (node: DocBlockTag) => {
      console.warn(styleText(['yellow'], `Got a ${node.tagName} block tag`));

      return `**${node.tagName}**`;
    },
  };
}
