import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors } from './apply-server-errors';

describe('applyServerErrors', () => {
  it('sets the server message on matching controls and returns unmatched fields', () => {
    const form = new FormGroup({ email: new FormControl('a@b.co') });

    const unmatched = applyServerErrors(form, { email: 'Ya registrado', other: 'x' });

    expect(form.controls.email.errors).toEqual({ server: 'Ya registrado' });
    expect(form.controls.email.touched).toBe(true);
    expect(unmatched).toEqual(['other']);
  });
});
