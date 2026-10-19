import { FormControl } from '@angular/forms';
import { phone } from './phone.validator';

function validate(value: string) {
  return phone()(new FormControl(value));
}

describe('phone', () => {
  it.each(['3001234567', '300 123 4567', '+57 (300) 123-4567', '6041234'])(
    'accepts %s',
    (value) => {
      expect(validate(value)).toBeNull();
    },
  );

  it.each(['123456', '1234567890123456', '300-abc-4567', '++573001234567'])(
    'rejects %s',
    (value) => {
      expect(validate(value)).toEqual({ phone: true });
    },
  );

  it('ignores empty values (handled by required)', () => {
    expect(validate('')).toBeNull();
  });
});
