import { expect, test } from 'bun:test';
import { linkLocations } from './links';
import { editorUrl } from './protocol';

const vscode = { name: 'VS Code', scheme: 'vscode' };

test('editorUrl builds editor scheme URLs', () => {
  expect(editorUrl(vscode, '/a/model.ts')).toBe('vscode://file/a/model.ts');
  expect(editorUrl(vscode, '/a b/model.ts', 3, 7)).toBe('vscode://file/a%20b/model.ts:3:7');
  expect(editorUrl(vscode, String.raw`C:\work\model.ts`, 3)).toBe(
    'vscode://file/C:/work/model.ts:3',
  );
});

test('links stack-trace and build-error locations, escaping everything else', () => {
  const html = linkLocations(
    'Error: <bad>\n    at cube (/x/api/index.ts:78:46)\n/x/dims.ts:1:21: Unexpected ;',
    vscode,
  );
  expect(html).toBe(
    'Error: &#60;bad&#62;\n    at cube (' +
      '<a href="vscode://file/x/api/index.ts:78:46" title="Open in VS Code">/x/api/index.ts:78:46</a>)\n' +
      '<a href="vscode://file/x/dims.ts:1:21" title="Open in VS Code">/x/dims.ts:1:21</a>: Unexpected ;',
  );
});

test('without an editor, text is only escaped', () => {
  expect(linkLocations('/x/a.ts:1 <b>')).toBe('/x/a.ts:1 &#60;b&#62;');
});
