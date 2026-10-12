import { expect, test } from 'bun:test';
import { optionsWit, witName } from './options-wit';

test('names become kebab-case, keywords are escaped', () => {
  expect(witName('overhangAngle')).toBe('overhang-angle');
  expect(witName('bed_size')).toBe('bed-size');
  expect(witName('type')).toBe('%type');
  expect(() => witName('export-3mf')).toThrow('not a valid WIT name');
});

test('maps schemars output to records, enums, options and tuples', () => {
  const wit = optionsWit('demo', {
    type: 'object',
    description: 'Demo options.',
    properties: {
      count: { type: 'integer', format: 'uint8', minimum: 1, maximum: 9 },
      size: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      tags: { type: 'array', items: { type: 'string' } },
      mode: { $ref: '#/$defs/Mode' },
      inner: { anyOf: [{ $ref: '#/$defs/Inner' }, { type: 'null' }] },
    },
    required: ['count', 'size', 'tags', 'mode'],
    $defs: {
      Mode: { type: 'string', enum: ['fast', 'fine'], description: 'How to run.' },
      Inner: { type: 'object', properties: { on: { type: 'boolean', default: true } } },
    },
  });
  expect(wit).toContain('package tscad:demo;');
  expect(wit).toContain('  enum mode {\n    fast,\n    fine,\n  }');
  expect(wit).toContain('  record inner {\n    /// @defaultValue true\n    on: option<bool>,\n  }');
  expect(wit).toContain(
    [
      '  /// Demo options.',
      '  record demo-options {',
      '    /// From 1 to 9.',
      '    count: u8,',
      '    size: tuple<f64, f64>,',
      '    tags: list<string>,',
      '    mode: mode,',
      '    inner: option<inner>,',
      '  }',
    ].join('\n'),
  );
  expect(wit).toContain('world demo {\n  use options.{demo-options};\n}');
});

test('rejects what WIT cannot express', () => {
  expect(() =>
    optionsWit('demo', {
      type: 'object',
      properties: { value: { anyOf: [{ type: 'number' }, { type: 'string' }] } },
    }),
  ).toThrow('unions other than "T or null"');
  expect(() =>
    optionsWit('demo', {
      type: 'object',
      properties: { id: { type: 'integer', format: 'uint64' } },
    }),
  ).toThrow('64-bit integers do not survive JSON');
});
