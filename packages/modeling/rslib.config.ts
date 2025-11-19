import { defineConfig, type RsbuildPlugin } from '@rslib/core';
import { MarkdownTemplate } from '@toolsync/template';
import { markdownTable } from 'markdown-table';
import { pluginRsbuildExec } from 'rsbuild-exec';

async function updateReadme() {
  const {
    default: { primitives: jsPrimitives },
  } = await import('@jscad/modeling');
  const tsPrimitives = await import('./out/primitives/index.js');

  const primitives = Object.keys(jsPrimitives).map(
    (name) => [name, { reExported: name in tsPrimitives }] as [string, { reExported: boolean }],
  );

  await MarkdownTemplate.update('README.md', {
    section: 'state',
    insert: 'bottom',
    content: `
**Primitives**

<details>
<summary>

Currently, **${primitives.filter(([, { reExported }]) => reExported).length} of ${
      primitives.length
    }** JSCAD primitives are re-exported in \`@tscad/modeling\`.

</summary>

${markdownTable([
  ['Primitive', 'Re-exported'],
  ...primitives.map(([name, { reExported }]) => [name, reExported ? '✅' : '❌']),
])
  // NOTE: Markdown Table does not support emojis well -> adjust some lines to match prettier formatting
  .replaceAll(/ {2}\|$/gm, ' |')}

</details>
`,
  });
}

export default defineConfig({
  source: {
    entry: {
      index: './src/index.ts',
      'colors/index': './src/colors/index.ts',
      'primitives/index': './src/primitives/index.ts',
      'convert/index': './src/convert/index.ts',
      'runtime/index': './src/runtime/index.ts',
    },
  },
  lib: [
    {
      id: 'esm',
      format: 'esm',
      syntax: 'es2022',
      dts: true,
      plugins: [
        {
          name: 'api-docs',
          setup(api) {
            api.onAfterEnvironmentCompile(async () => {
              // eslint-disable-next-line no-console
              console.time('UPDATE README');
              await updateReadme();
              // eslint-disable-next-line no-console
              console.timeEnd('UPDATE README');
            });
          },
        } satisfies RsbuildPlugin,
        pluginRsbuildExec({
          title: 'api-docs',
          command: 'pnpm build-api-docs',
        }),
      ],
    },
    {
      id: 'cjs',
      format: 'cjs',
      syntax: 'es2022',
      dts: false,
    },
    {
      id: 'standalone',
      format: 'esm',
      syntax: 'es2022',
      dts: false,
      autoExternal: false,
      output: {
        distPath: 'out/standalone',
      },
    },
  ],
  output: {
    distPath: 'out',
    target: 'node',
    sourceMap: true,
  },
});
