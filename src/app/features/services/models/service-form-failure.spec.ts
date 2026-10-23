import { ApiError } from '@core/http/api-error.model';
import { SERVICE_FORM_MESSAGES, toServiceFormFailure } from './service-form-failure';

function error(kind: ApiError['kind'], fieldErrors = {}): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors };
}

describe('toServiceFormFailure', () => {
  it('maps a 400 to field errors', () => {
    const failure = toServiceFormFailure(error('validation', { price: 'Debe ser >= 0' }));

    expect(failure.summary).toBe(SERVICE_FORM_MESSAGES.checkFields);
    expect(failure.fieldErrors).toEqual({ price: 'Debe ser >= 0' });
  });

  it('maps a 409 to an error on the name field', () => {
    const failure = toServiceFormFailure(error('conflict'));

    expect(failure.summary).toBe(SERVICE_FORM_MESSAGES.duplicate);
    expect(failure.fieldErrors).toEqual({ name: SERVICE_FORM_MESSAGES.duplicateName });
  });

  it.each([
    ['forbidden', SERVICE_FORM_MESSAGES.businessRequired],
    ['network', SERVICE_FORM_MESSAGES.network],
    ['server', SERVICE_FORM_MESSAGES.unexpected],
    ['unknown', SERVICE_FORM_MESSAGES.unexpected],
  ] as const)('maps %s to a generic message', (kind, summary) => {
    const failure = toServiceFormFailure(error(kind));

    expect(failure.summary).toBe(summary);
    expect(failure.fieldErrors).toEqual({});
  });

  it('never shows server details', () => {
    expect(JSON.stringify(toServiceFormFailure(error('server')))).not.toContain('internal details');
  });
});
