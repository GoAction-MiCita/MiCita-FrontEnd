import { FormControl } from '@angular/forms';
import { nit } from './nit.validator';

function validate(value: string) {
  return nit()(new FormControl(value));
}

describe('nit', () => {
  it.each(['900.123.456-7', '900123456-7', '900123456', '1234567890', ' 800.200.300 '])(
    'accepts %s',
    (value) => {
      expect(validate(value)).toBeNull();
    },
  );

  it.each(['12345', '900-123-456', '900.123.456-78', 'ABC123456', '12345678901'])(
    'rejects %s',
    (value) => {
      expect(validate(value)).toEqual({ nit: true });
    },
  );

  it('accepts an empty value (optional field)', () => {
    expect(validate('')).toBeNull();
  });
});
