import { FormControl } from '@angular/forms';
import { notBlank } from './not-blank.validator';

function validate(value: string | null) {
  return notBlank()(new FormControl(value));
}

describe('notBlank', () => {
  it.each(['Ana', ' Ana ', 'a'])('accepts %j', (value) => {
    expect(validate(value)).toBeNull();
  });

  it.each([' ', '   ', '\t', '\n ', ' '])('rejects the blank value %j as required', (value) => {
    expect(validate(value)).toEqual({ required: true });
  });

  it.each([null, ''])('leaves the empty value %j to Validators.required', (value) => {
    expect(validate(value)).toBeNull();
  });
});
