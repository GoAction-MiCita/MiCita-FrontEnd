import {
  hasServiceFilters,
  NO_SERVICE_FILTERS,
  sameServiceFilters,
  toServiceFilterParams,
  toServiceFilters,
} from './service-filters';

describe('service filters', () => {
  it('reads the query params', () => {
    expect(toServiceFilters({ name: ' cor ', status: 'ACTIVE', employeeIds: 'e1, e2,' })).toEqual({
      name: 'cor',
      status: 'ACTIVE',
      employeeIds: ['e1', 'e2'],
    });
  });

  it('treats missing params as no filter', () => {
    expect(toServiceFilters({})).toEqual(NO_SERVICE_FILTERS);
    expect(hasServiceFilters(NO_SERVICE_FILTERS)).toBe(false);
  });

  it.each(['DELETED', 'active', '<script>', ''])('ignores the status %j', (status) => {
    expect(toServiceFilters({ status }).status).toBeNull();
  });

  it('caps an overlong name from the URL', () => {
    expect(toServiceFilters({ name: 'a'.repeat(500) }).name).toHaveLength(100);
  });

  it('writes only the filters in use (null removes the param)', () => {
    expect(toServiceFilterParams(NO_SERVICE_FILTERS)).toEqual({
      name: null,
      status: null,
      employeeIds: null,
    });
    expect(
      toServiceFilterParams({ name: ' cor ', status: 'INACTIVE', employeeIds: ['e1', 'e2'] }),
    ).toEqual({ name: 'cor', status: 'INACTIVE', employeeIds: 'e1,e2' });
  });

  it('round-trips through the URL', () => {
    const filters = { name: 'cor', status: 'ACTIVE' as const, employeeIds: ['e1'] };
    const params = toServiceFilterParams(filters);

    expect(
      toServiceFilters({
        name: params['name'],
        status: params['status'],
        employeeIds: params['employeeIds'],
      }),
    ).toEqual(filters);
  });

  it('compares filters by value', () => {
    expect(sameServiceFilters({ ...NO_SERVICE_FILTERS, employeeIds: [] }, NO_SERVICE_FILTERS)).toBe(
      true,
    );
    expect(sameServiceFilters({ ...NO_SERVICE_FILTERS, name: 'a' }, NO_SERVICE_FILTERS)).toBe(
      false,
    );
    expect(
      sameServiceFilters(
        { ...NO_SERVICE_FILTERS, employeeIds: ['a'] },
        { ...NO_SERVICE_FILTERS, employeeIds: ['b'] },
      ),
    ).toBe(false);
  });
});
