import { resolveErrorMessage } from './error-messages';

describe('resolveErrorMessage', () => {
  it('returns null when there are no errors', () => {
    expect(resolveErrorMessage(null)).toBeNull();
  });

  it('uses the default message', () => {
    expect(resolveErrorMessage({ email: true })).toBe('Ingresa un correo válido');
  });

  it('prefers the field override', () => {
    expect(resolveErrorMessage({ required: true }, { required: 'El nombre es obligatorio' })).toBe(
      'El nombre es obligatorio',
    );
  });

  it('gives the server error priority over client errors', () => {
    expect(resolveErrorMessage({ email: true, server: 'Ya registrado' })).toBe('Ya registrado');
  });

  it('formats length errors', () => {
    expect(resolveErrorMessage({ minlength: { requiredLength: 3, actualLength: 1 } })).toBe(
      'Debe tener al menos 3 caracteres',
    );
  });

  it('shows nothing for password strength (rendered as a checklist)', () => {
    expect(resolveErrorMessage({ passwordStrength: { failed: ['special'] } })).toBeNull();
  });

  it('skips unknown errors', () => {
    expect(resolveErrorMessage({ custom: true })).toBeNull();
  });
});
