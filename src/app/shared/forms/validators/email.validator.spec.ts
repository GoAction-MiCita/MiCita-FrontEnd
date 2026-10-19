import { FormControl } from '@angular/forms';
import { email } from './email.validator';

function validate(value: string) {
  return email()(new FormControl(value));
}

describe('email', () => {
  it.each(['ana@correo.com', 'ana.lopez+citas@mi-empresa.com.co', ' ana@correo.co '])(
    'accepts %s',
    (value) => {
      expect(validate(value)).toBeNull();
    },
  );

  it.each(['ana.lopez@correo', 'ana@', '@correo.com', 'ana lopez@correo.com', 'ana@correo.c'])(
    'rejects %s',
    (value) => {
      expect(validate(value)).toEqual({ email: true });
    },
  );

  it('ignores empty values (handled by required)', () => {
    expect(validate('')).toBeNull();
  });
});
