import { describe, expect, it } from 'vitest';
import { pauseLengthOf } from './index';

describe('pauseLengthOf', () => {
  it.each(['hour', 'twoHours', 'restOfToday'])('is the PauseLength "%s" for that exact string', (value) => {
    expect(pauseLengthOf(value)).toBe(value);
  });
});

describe('pauseLengthOf, on anything else', () => {
  it.each<[string, unknown]>([
    ['another string', 'week'],
    ['a different case', 'Hour'],
    ['the empty string', ''],
    ['an array (a repeated route param)', ['hour']],
    ['a number', 1],
    ['undefined', undefined],
    ['null', null],
    ['an Object prototype key', 'toString'],
  ])('is undefined for %s', (_, value) => {
    expect(pauseLengthOf(value)).toBeUndefined();
  });
});
