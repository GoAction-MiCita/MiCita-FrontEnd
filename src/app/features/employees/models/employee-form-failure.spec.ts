import { ApiError } from '@core/http/api-error.model';
import { REJECTED_SERVICES_MESSAGE } from './employee.mapper';
import { EMPLOYEE_FORM_MESSAGES, toEmployeeFormFailure } from './employee-form-failure';

const error = (kind: ApiError['kind'], fieldErrors: ApiError['fieldErrors'] = {}): ApiError => ({
  kind,
  status: 0,
  message: 'detalle interno',
  fieldErrors,
});

describe('toEmployeeFormFailure', () => {
  it('maps a 400 to field errors and the rejected services', () => {
    expect(
      toEmployeeFormFailure(error('validation', { lastName: 'Muy largo', 'serviceIds[0]': 'x' }), [
        's9',
      ]),
    ).toEqual({
      title: EMPLOYEE_FORM_MESSAGES.title,
      summary: EMPLOYEE_FORM_MESSAGES.checkFields,
      fieldErrors: { lastName: 'Muy largo', serviceIds: REJECTED_SERVICES_MESSAGE },
      rejectedServiceIds: ['s9'],
    });
  });

  it.each([
    [{ email: 'dup' }, { email: EMPLOYEE_FORM_MESSAGES.duplicateEmail }],
    [{ phone: 'dup' }, { phone: EMPLOYEE_FORM_MESSAGES.duplicatePhone }],
    [
      { email: 'dup', phone: 'dup' },
      {
        email: EMPLOYEE_FORM_MESSAGES.duplicateEmail,
        phone: EMPLOYEE_FORM_MESSAGES.duplicatePhone,
      },
    ],
    [{}, {}],
  ])('maps a 409 with %o to the duplicated fields', (fieldErrors, expected) => {
    expect(toEmployeeFormFailure(error('conflict', fieldErrors))).toEqual({
      title: EMPLOYEE_FORM_MESSAGES.title,
      summary: EMPLOYEE_FORM_MESSAGES.duplicate,
      fieldErrors: expected,
    });
  });

  it.each([
    ['forbidden', EMPLOYEE_FORM_MESSAGES.businessRequired],
    ['network', EMPLOYEE_FORM_MESSAGES.network],
    ['server', EMPLOYEE_FORM_MESSAGES.unexpected],
  ] as const)('maps %s without server details', (kind, summary) => {
    expect(toEmployeeFormFailure(error(kind))).toEqual({
      title: EMPLOYEE_FORM_MESSAGES.title,
      summary,
      fieldErrors: {},
    });
  });
});
