/**
 * Runs `@example` blocks. An example is a few statements with the whole API (and zod's `z`) in
 * scope, plugin packages included; every top-level expression (or `export default`) is a result to show, together with the
 * code since the previous one:
 *
 * ```ts
 * const wedge = linear_extrude(…);
 * mirror({ x: 1 }, wedge) // cell 1: the const and this line → one picture
 * union(wedge, mirror(…)) // cell 2 → another picture
 * ```
 */
import * as api from '@tscad/modeling';
import { evaluateModel, Shape, Shape2D, type ModelExport } from '@tscad/modeling';
import ts from 'typescript';
import { z } from 'zod';
import { pluginModules } from './extract';

export type Cell = { code: string };
export type Result = { code: string; value: Shape | Shape2D };

/** The exports of each built plugin package, by import specifier. */
export const PLUGIN_SCOPES: { specifier: string; entry: string; names: string[] }[] =
  await Promise.all(
    pluginModules().map(async (module) => ({
      ...module,
      names: Object.keys(await import(module.entry)),
    })),
  );

/** Names an example can use without importing them. */
export const SCOPE: Record<string, unknown> = { ...api, z };
for (const { entry } of PLUGIN_SCOPES) Object.assign(SCOPE, await import(entry));

/** Splits an example into cells, each ending with an expression whose value is shown. */
export function cells(code: string): {
  cells: Cell[];
  shown: ts.Statement[];
  source: ts.SourceFile;
} {
  const source = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true);
  const shown = source.statements.filter(
    (s) => ts.isExpressionStatement(s) || ts.isExportAssignment(s),
  );
  const result: Cell[] = [];
  let start = 0;
  for (const statement of shown) {
    // Through the end of the line, to keep a trailing `// comment`.
    const lineEnd = code.indexOf('\n', statement.end);
    const end = lineEnd === -1 ? code.length : lineEnd;
    result.push({ code: code.slice(start, end).replace(/^\n+/, '') });
    start = end;
  }
  return { cells: result, shown, source };
}

/** Code that calls `__show(value)` for every shown expression, as plain JavaScript. */
export function instrument(code: string): string {
  const { shown } = cells(code);
  let rewritten = code;
  for (const statement of [...shown].reverse()) {
    const expression = ts.isExportAssignment(statement)
      ? statement.expression
      : (statement as ts.ExpressionStatement).expression;
    rewritten = `${rewritten.slice(0, statement.getStart())}__show(${expression.getText()});${rewritten.slice(statement.end)}`;
  }
  return ts.transpileModule(rewritten, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...parameters: string[]
) => (...values: unknown[]) => Promise<void>;

/** Runs an example; each cell's value as a shape (models are built with their defaults). */
export async function runExample(code: string): Promise<Result[]> {
  const values: unknown[] = [];
  const run = new AsyncFunction(
    '__scope',
    '__show',
    `const { ${Object.keys(SCOPE).join(', ')} } = __scope;\n${instrument(code)}`,
  );
  await run(SCOPE, (value: unknown) => values.push(value));
  const { cells: list } = cells(code);
  return Promise.all(
    values.map(async (value, index) => {
      if (value instanceof Shape2D) return { code: list[index]!.code, value };
      const result = await evaluateModel(value as ModelExport);
      if (result.error !== undefined) throw new Error(result.error);
      return { code: list[index]!.code, value: result.tree };
    }),
  );
}
