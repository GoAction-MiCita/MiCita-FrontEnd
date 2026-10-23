import { ApiError } from '@core/http/api-error.model';
import {
  DELETE_SERVICE_MESSAGES,
  futureAppointmentsMessage,
  toDeleteServiceFailure,
} from './delete-service-failure';

function error(kind: ApiError['kind']): ApiError {
  return { kind, status: 0, message: 'internal details', fieldErrors: {} };
}

describe('toDeleteServiceFailure', () => {
  it('maps a 409 to the future appointments message and blocks the deletion', () => {
    expect(toDeleteServiceFailure(error('conflict'), 'Barba')).toEqual({
      title: DELETE_SERVICE_MESSAGES.blockedTitle,
      summary: futureAppointmentsMessage('Barba'),
      blocked: true,
    });
    expect(futureAppointmentsMessage('Barba')).toContain('Puedes desactivarlo');
  });

  it.each([
    ['forbidden', DELETE_SERVICE_MESSAGES.businessRequired],
    ['network', DELETE_SERVICE_MESSAGES.network],
    ['server', DELETE_SERVICE_MESSAGES.unexpected],
    ['unknown', DELETE_SERVICE_MESSAGES.unexpected],
  ] as const)('maps %s to a retryable generic message', (kind, summary) => {
    expect(toDeleteServiceFailure(error(kind), 'Barba')).toEqual({
      title: DELETE_SERVICE_MESSAGES.title,
      summary,
      blocked: false,
    });
  });

  it('never shows server details', () => {
    expect(JSON.stringify(toDeleteServiceFailure(error('server'), 'Barba'))).not.toContain(
      'internal details',
    );
  });
});
