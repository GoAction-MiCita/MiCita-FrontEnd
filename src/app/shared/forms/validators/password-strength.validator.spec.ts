import { FormControl } from '@angular/forms';
import { passwordStrength } from './password-strength.validator';

function validate(value: string) {
  return passwordStrength()(new FormControl(value));
}

describe('passwordStrength', () => {
  it('accepts a password that meets every rule', () => {
    expect(validate('Abc#12')).toBeNull();
  });

  it('ignores empty values (handled by required)', () => {
    expect(validate('')).toBeNull();
  });

  it('lists every failed rule', () => {
    expect(validate('abc')).toEqual({
      passwordStrength: { failed: ['minLength', 'uppercase', 'special'] },
    });
  });

  it('does not count a space as a special character', () => {
    expect(validate('Abc de1')).toEqual({ passwordStrength: { failed: ['special'] } });
  });

  it('uses ASCII letters like the backend: accented letters count as special', () => {
    expect(validate('ñABC12')).toEqual({ passwordStrength: { failed: ['lowercase'] } });
    expect(validate('Ñabc12')).toEqual({ passwordStrength: { failed: ['uppercase'] } });
    expect(validate('Abcdeñ')).toBeNull();
  });

  it('rejects passwords longer than 72 characters', () => {
    expect(validate(`Aa#${'x'.repeat(70)}`)).toEqual({
      passwordStrength: { failed: ['maxLength'] },
    });
  });
});
