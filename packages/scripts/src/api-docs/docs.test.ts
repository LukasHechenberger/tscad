import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { cells, runExample, SCOPE } from './examples';
import { compilerOptions, extractDocs, ROOT } from './extract';
import { docsKernel, renderSvg } from './render';

const entries = extractDocs();
const examples = entries.flatMap((entry) =>
  entry.examples.map((code, index) => ({ label: `${entry.name} example ${index + 1}`, code })),
);

test('every documented function and class has text, and every function an example', () => {
  expect(entries.length).toBeGreaterThan(20);
  for (const entry of entries.filter((entry) => entry.kind !== 'type')) {
    expect({ name: entry.name, hasText: entry.documentation.length > 0 }).toEqual({
      name: entry.name,
      hasText: true,
    });
    if (entry.kind === 'function')
      expect({ name: entry.name, examples: entry.examples.length > 0 }).toEqual({
        name: entry.name,
        examples: true,
      });
  }
});

test('examples split into one cell per shown expression', () => {
  const code = 'const a = cube(1);\nunion(a, a) // pair\n\nsphere({ r: 1 })';
  expect(cells(code).cells.map((c) => c.code)).toEqual([
    'const a = cube(1);\nunion(a, a) // pair',
    'sphere({ r: 1 })',
  ]);
});

test('examples type-check against the API', () => {
  // All examples as functions in one virtual module next to this file, importing what they may use.
  const file = path.join(import.meta.dir, '__examples__.ts');
  const names = Object.keys(SCOPE).filter((name) => name !== 'z');
  const source = [
    `import { ${names.join(', ')} } from "@tscad/modeling";`,
    `import { z } from "zod";`,
    ...examples.map(
      ({ code }, index) =>
        `export async function example${index}() {\n${code.replace(/^export default /m, 'return ')}\n}`,
    ),
  ].join('\n');
  const options = compilerOptions();
  const host = ts.createCompilerHost(options);
  const { getSourceFile, fileExists, readFile } = host;
  host.getSourceFile = (name, version, ...rest) =>
    name === file
      ? ts.createSourceFile(name, source, version)
      : getSourceFile.call(host, name, version, ...rest);
  host.fileExists = (name) => name === file || fileExists.call(host, name);
  host.readFile = (name) => (name === file ? source : readFile.call(host, name));
  const program = ts.createProgram([file], options, host);
  const sourceFile = program.getSourceFile(file)!;
  const errors = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ].map((diagnostic) => {
    const line = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line;
    const header = source
      .split('\n')
      .slice(0, line + 1)
      .reverse()
      .find((text) => text.startsWith('export async function example'));
    const label = examples[Number(/example(\d+)/.exec(header ?? '')?.[1])]?.label ?? 'header';
    return `${label}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
  });
  expect(errors).toEqual([]);
});

describe('examples render', async () => {
  const context = await docsKernel();
  const pluginsBuilt = existsSync(path.join(ROOT, 'plugins/grid/dist/plugin.js'));
  for (const { label, code } of examples) {
    test(label, async () => {
      for (const { value } of await runExample(code)) {
        if (!pluginsBuilt && JSON.stringify(value.node).includes('"type":"plugin"')) continue; // needs the plugins built
        const svg = new TextDecoder().decode(await renderSvg(context, value));
        expect(svg.startsWith('<svg')).toBe(true);
      }
    });
  }
});
