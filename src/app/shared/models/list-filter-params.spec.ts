import { capName, NAME_FILTER_MAX_LENGTH, sameIds, splitIds } from './list-filter-params';

describe('capName', () => {
  it('trims the name', () => {
    expect(capName('  cor ')).toBe('cor');
  });

  it('treats a missing name as empty', () => {
    expect(capName(null)).toBe('');
    expect(capName(undefined)).toBe('');
  });

  it('caps an overlong name', () => {
    expect(capName('a'.repeat(500))).toHaveLength(NAME_FILTER_MAX_LENGTH);
    expect(NAME_FILTER_MAX_LENGTH).toBe(100);
  });
});

describe('splitIds', () => {
  it('splits, trims and drops blanks', () => {
    expect(splitIds('e1, e2,, ,')).toEqual(['e1', 'e2']);
  });

  it('drops repeats, keeping the first order', () => {
    expect(splitIds('b,a,b,a')).toEqual(['b', 'a']);
  });

  it('treats a missing value as no ids', () => {
    expect(splitIds(null)).toEqual([]);
    expect(splitIds(undefined)).toEqual([]);
    expect(splitIds('')).toEqual([]);
  });
});

describe('sameIds', () => {
  it('compares by value and order', () => {
    expect(sameIds([], [])).toBe(true);
    expect(sameIds(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
  });
});
