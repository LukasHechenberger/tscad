import * as Twoslash from 'fumadocs-twoslash/ui';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { Example } from '@/components/example';

// use this function to get MDX components, you will need it for rendering MDX
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    ...Twoslash,
    // Used by the generated API reference (build-api-docs)
    TypeTable,
    Example,
    ...components,
  };
}
