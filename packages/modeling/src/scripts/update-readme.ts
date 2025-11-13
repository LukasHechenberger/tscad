/* eslint-disable jsdoc/require-jsdoc */

import { MarkdownTemplate } from '@toolsync/template';
import { markdownTable } from 'markdown-table';

async function updateReadme() {
  const {
    default: { primitives: jsPrimitives },
  } = await import('@jscad/modeling');
  const tsPrimitives = await import('../primitives/index.js');

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

// eslint-disable-next-line unicorn/prefer-top-level-await -- because we also build cjs
updateReadme().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
