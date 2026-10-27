import { ApiError } from '@core/http/api-error.model';
import {
  DELETE_EMPLOYEE_MESSAGES,
  futureAppointmentsMessage,
  toDeleteEmployeeFailure,
} from './delete-employee-failure';
import { Employee } from './employee.model';

const ana: Employee = {
  id: 'e1',
  firstName: 'Ana',
  lastName: 'López',
  fullName: 'Ana López',
  phone: null,
  email: null,
  status: 'ACTIVE',
  services: [],
};

function error(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
}

describe('toDeleteEmployeeFailure', () => {
  it('maps a 409 to the future appointments message and blocks the deletion', () => {
    expect(toDeleteEmployeeFailure(error('conflict'), ana)).toEqual({
      title: DELETE_EMPLOYEE_MESSAGES.blockedTitle,
      summary: futureAppointmentsMessage(ana),
      blocked: true,
    });
  });

  it('suggests deactivating an active employee, and not an inactive one', () => {
    expect(futureAppointmentsMessage(ana)).toBe(
      '«Ana López» tiene citas futuras. Puedes desactivarlo para que no reciba nuevas citas.',
    );
    expect(futureAppointmentsMessage({ ...ana, status: 'INACTIVE' })).toContain('Ya está inactivo');
  });

  it.each([
    ['forbidden', DELETE_EMPLOYEE_MESSAGES.businessRequired],
    ['network', DELETE_EMPLOYEE_MESSAGES.network],
    ['server', DELETE_EMPLOYEE_MESSAGES.unexpected],
    ['unknown', DELETE_EMPLOYEE_MESSAGES.unexpected],
  ] as const)('maps %s to a retryable generic message', (kind, summary) => {
    expect(toDeleteEmployeeFailure(error(kind), ana)).toEqual({
      title: DELETE_EMPLOYEE_MESSAGES.title,
      summary,
      blocked: false,
    });
  });

  it('never shows server details', () => {
    expect(JSON.stringify(toDeleteEmployeeFailure(error('server'), ana))).not.toContain(
      'internal details',
    );
  });
});
