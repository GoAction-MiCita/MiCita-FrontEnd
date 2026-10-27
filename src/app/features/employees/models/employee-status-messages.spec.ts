import { ApiError } from '@core/http/api-error.model';
import {
  EMPLOYEE_STATUS_MESSAGES,
  employeeStatusChangedMessage,
  toEmployeeStatusFailureMessage,
} from './employee-status-messages';

function error(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
}

describe('employee status messages', () => {
  it('says that deactivating stops new appointments and keeps the existing ones', () => {
    expect(employeeStatusChangedMessage('INACTIVE')).toBe(EMPLOYEE_STATUS_MESSAGES.deactivated);
    expect(EMPLOYEE_STATUS_MESSAGES.deactivated).toContain(
      'No recibirá nuevas citas y las existentes no cambian',
    );
    expect(employeeStatusChangedMessage('ACTIVE')).toBe(EMPLOYEE_STATUS_MESSAGES.activated);
  });

  it.each([
    ['not-found', EMPLOYEE_STATUS_MESSAGES.notFound],
    ['forbidden', EMPLOYEE_STATUS_MESSAGES.businessRequired],
    ['network', EMPLOYEE_STATUS_MESSAGES.network],
    ['validation', EMPLOYEE_STATUS_MESSAGES.unexpected],
    ['server', EMPLOYEE_STATUS_MESSAGES.unexpected],
  ] as const)('maps %s without server details', (kind, message) => {
    expect(toEmployeeStatusFailureMessage(error(kind))).toBe(message);
    expect(toEmployeeStatusFailureMessage(error(kind))).not.toContain('internal details');
  });
});
