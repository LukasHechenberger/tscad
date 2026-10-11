import { expect, test } from 'bun:test';
import { formatReport, formatValue, humanize } from './report';

test('humanizes keys', () => {
  expect(humanize('bedContactArea')).toBe('bed contact area');
  expect(humanize('fits_bed')).toBe('fits bed');
});

test('formats values by kind and magnitude', () => {
  expect(formatValue(true)).toBe('yes');
  expect(formatValue(6808)).toBe('6,808');
  expect(formatValue(25_979.48)).toBe('25,979');
  expect(formatValue(12.345)).toBe('12.3');
  expect(formatValue(0.12345)).toBe('0.123');
  expect(formatValue([170.15000002, 128.15, 5])).toBe('170 × 128 × 5');
});

test('separates warnings and passes errors through', () => {
  expect(formatReport({ fitsBed: false, warnings: ['too big'] })).toEqual({
    rows: [['fits bed', 'no']],
    warnings: ['too big'],
  });
  expect(formatReport({ error: 'plugin crashed' })).toEqual({
    rows: [],
    warnings: [],
    error: 'plugin crashed',
  });
});
