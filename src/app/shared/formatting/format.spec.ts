import { EMPTY_VALUE, formatCop, formatDuration, formatThousands, initials } from './format';

describe('formatThousands', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1500, '1.500'],
    [45000, '45.000'],
    [1234567, '1.234.567'],
    [-1500, '-1.500'],
    [1499.6, '1.500'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatThousands(value)).toBe(expected);
  });
});

describe('formatCop', () => {
  it.each([
    [45000, '$ 45.000'],
    [0, '$ 0'],
    [1234567, '$ 1.234.567'],
    [45000.6, '$ 45.001'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatCop(value)).toBe(expected);
  });

  it.each([null, undefined, Number.NaN])('renders %s as empty', (value) => {
    expect(formatCop(value)).toBe(EMPTY_VALUE);
  });
});

describe('formatDuration', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [125, '2 h 5 min'],
  ])('formats %s minutes as %s', (value, expected) => {
    expect(formatDuration(value)).toBe(expected);
  });

  it.each([null, undefined, 0, -10, Number.NaN])('renders %s as empty', (value) => {
    expect(formatDuration(value)).toBe(EMPTY_VALUE);
  });
});

describe('initials', () => {
  it.each([
    ['Ana López', 'AL'],
    ['maría josé gómez', 'MG'],
    ['Juan', 'J'],
    ['   ', '?'],
  ])('returns the initials of %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
