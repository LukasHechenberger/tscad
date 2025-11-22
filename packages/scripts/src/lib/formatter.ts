/* eslint-disable no-console */

import { styleText } from 'node:util';
import type { ApiItem, ApiModel } from '@microsoft/api-extractor-model';
import {
  DocDeclarationReference,
  DocExcerpt,
  DocLinkTag,
  DocNode,
  DocNodeContainer,
  DocNodeKind,
  DocPlainText,
  ExcerptKind,
} from '@microsoft/tsdoc';

abstract class Renderer<Kinds extends string | number> {
  protected abstract handlers: Partial<{
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

class PlainTextRenderer extends TsdocRenderer {
  protected plaintextHandlers = {
    [DocNodeKind.PlainText]: (node: DocPlainText) => node.text,
    [DocNodeKind.Paragraph]: this.renderChildNodes,
    [DocNodeKind.Section]: this.renderChildNodes,
    [DocNodeKind.Excerpt]: this.renderChildNodes,
    [DocNodeKind.SoftBreak]: () => '\n\n',
    [DocNodeKind.DeclarationReference]: (
      node: DocDeclarationReference,
      contextApiItem: ApiItem,
    ) => {
      const memberReference = node.memberReferences[0];
      if (!memberReference || node.memberReferences.length > 1) {
        throw new Error('Only single member references are supported');
      }

      const identifier = memberReference.memberIdentifier?.identifier;
      if (!identifier) {
        throw new Error('Only member references with identifiers are supported');
      }

      if (!contextApiItem) {
        throw new Error('Context ApiItem is required to resolve declaration references');
      }

      const resolved = this.apiModel.resolveDeclarationReference(
        node,
        contextApiItem.getAssociatedPackage(),
      );

      if (resolved?.errorMessage) {
        throw new Error(`Failed to resolve declaration reference: ${resolved.errorMessage}`);
      }

      return identifier;
    },
  };

  protected handlers = this.plaintextHandlers;
}

export class MarkdownRenderer extends PlainTextRenderer {
  protected handlers = {
    ...this.plaintextHandlers,
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
        }
      }

      if (!target) {
        console.warn(`LinkTag is missing a target: ${title}`);

        return `${title}`;
      }

      return `[${title}](${target})`;
    },
  };
}
