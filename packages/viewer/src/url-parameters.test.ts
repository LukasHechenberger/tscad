import { expect, test } from 'bun:test';
import type { ParametersJsonSchema } from '@tscad/modeling';
import { valuesFromQuery, valuesToQuery } from './url-parameters';

const schema: ParametersJsonSchema = {
  properties: {
    width: { type: 'integer', default: 4 },
    padded: { type: 'boolean', default: true },
    label: { type: 'string', default: '' },
  },
};

test('only non-default values go into the URL', () => {
  expect(valuesToQuery(schema, { width: 4, padded: true, label: '' })).toBe('');
  expect(valuesToQuery(schema, { width: 2, padded: false, label: 'a b' })).toBe(
    'width=2&padded=false&label=a+b',
  );
});

test('URL values are typed by the schema and unknown keys dropped', () => {
  expect(valuesFromQuery(schema, 'width=2&padded=false&label=a+b&stale=1')).toEqual({
    width: 2,
    padded: false,
    label: 'a b',
  });
});
