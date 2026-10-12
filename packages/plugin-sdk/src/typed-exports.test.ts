import { expect, test } from 'bun:test';
import { functionName, optionsType, typedExports } from './typed-exports';

// What `jco types` writes for a `stack-options` record (with its trailing spaces).
const declarations = `/** @module Interface tscad:stack/options **/
/**
 * Stacks copies.
 * 
 * @example
 * \`\`\`ts
 * stack({ count: 2 }, cube(1))
 * \`\`\`
 */
export interface StackOptions {
  /**
   * Heights.
   */
  heights?: Float64Array,
}
`;

test('names follow the plugin name', () => {
  expect(functionName('export-3mf')).toBe('export3mf');
  expect(optionsType('layer-stack')).toBe('LayerStackOptions');
});

test('an operation gets a typed function, documented for the API reference', () => {
  const { js, dts } = typedExports({
    plugin: 'stack',
    packageName: 'tscad-plugin-stack',
    isOperation: true,
    declarations,
  });
  expect(js).toContain(`const operation = pluginOperation('stack');`);
  expect(js).toContain('export function stack(options, ...children) {');
  expect(dts).toContain('heights?: Array<number>,');
  expect(dts).not.toMatch(/[ \t]$/m);
  expect(dts).toContain(
    [
      '/**',
      ' * Stacks copies.',
      ' *',
      ' * Import it from `tscad-plugin-stack`.',
      ' *',
      ' * @example',
      ' * ```ts',
      ' * stack({ count: 2 }, cube(1))',
      ' * ```',
      ' * @category Plugins',
      ' */',
      'export declare function stack(options: StackOptions, ...children: Shape[]): Shape;',
    ].join('\n'),
  );
});

test('other plugins only get their options types', () => {
  const { js, dts } = typedExports({
    plugin: 'stack',
    packageName: 'tscad-plugin-stack',
    isOperation: false,
    declarations,
  });
  expect(js).toContain('export {};');
  expect(dts).toContain('export interface StackOptions {');
  expect(dts).not.toContain('declare function');
});

test('options may not reference other interfaces', () => {
  expect(() =>
    typedExports({
      plugin: 'stack',
      packageName: 'x',
      isOperation: true,
      declarations: `${declarations}export type Vec3 = import('./tscad-plugin-types.js').Vec3;\n`,
    }),
  ).toThrow('options may only use their own types');
});
