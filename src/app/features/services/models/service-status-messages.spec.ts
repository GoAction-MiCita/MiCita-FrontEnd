import { ApiError } from '@core/http/api-error.model';
import {
  SERVICE_STATUS_MESSAGES,
  statusChangedMessage,
  toServiceStatusFailureMessage,
} from './service-status-messages';

function error(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
}

describe('service status messages', () => {
  it('says that deactivating keeps the existing appointments', () => {
    expect(statusChangedMessage('INACTIVE')).toBe(SERVICE_STATUS_MESSAGES.deactivated);
    expect(SERVICE_STATUS_MESSAGES.deactivated).toContain('citas existentes no se eliminan');
    expect(statusChangedMessage('ACTIVE')).toBe(SERVICE_STATUS_MESSAGES.activated);
  });

  it.each([
    ['not-found', SERVICE_STATUS_MESSAGES.notFound],
    ['forbidden', SERVICE_STATUS_MESSAGES.businessRequired],
    ['network', SERVICE_STATUS_MESSAGES.network],
    ['validation', SERVICE_STATUS_MESSAGES.unexpected],
    ['server', SERVICE_STATUS_MESSAGES.unexpected],
  ] as const)('maps %s without server details', (kind, message) => {
    expect(toServiceStatusFailureMessage(error(kind))).toBe(message);
    expect(toServiceStatusFailureMessage(error(kind))).not.toContain('internal details');
  });
});
