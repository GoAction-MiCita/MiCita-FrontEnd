import { FormControl } from '@angular/forms';
import { integer } from './integer.validator';

function validate(value: number | string | null) {
  return integer()(new FormControl(value));
}

describe('integer', () => {
  it.each([0, 30, 45000, '120', -5])('accepts %s', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each([12.5, '1.5', 'abc', '1e', Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %s',
    (value) => {
      expect(validate(value)).toEqual({ integer: true });
    },
  );

  it.each([null, ''])('ignores the empty value %s', (value) => {
    expect(validate(value)).toBeNull();
  });
});
