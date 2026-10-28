import {
  hasEmployeeFilters,
  NO_EMPLOYEE_FILTERS,
  sameEmployeeFilters,
  toEmployeeFilterParams,
  toEmployeeFilters,
} from './employee-filters';

describe('employee filters', () => {
  it('reads the query params', () => {
    expect(toEmployeeFilters({ name: ' cor ', status: 'ACTIVE', serviceIds: 'e1, e2,' })).toEqual({
      name: 'cor',
      status: 'ACTIVE',
      serviceIds: ['e1', 'e2'],
    });
  });

  it('treats missing params as no filter', () => {
    expect(toEmployeeFilters({})).toEqual(NO_EMPLOYEE_FILTERS);
    expect(hasEmployeeFilters(NO_EMPLOYEE_FILTERS)).toBe(false);
  });

  it.each(['DELETED', 'active', '<script>', ''])('ignores the status %j', (status) => {
    expect(toEmployeeFilters({ status }).status).toBeNull();
  });

  it('caps an overlong name from the URL', () => {
    expect(toEmployeeFilters({ name: 'a'.repeat(500) }).name).toHaveLength(100);
  });

  it('drops repeated services from the URL', () => {
    expect(toEmployeeFilters({ serviceIds: 's1,s2,s1' }).serviceIds).toEqual(['s1', 's2']);
  });

  it('writes only the filters in use (null removes the param)', () => {
    expect(toEmployeeFilterParams(NO_EMPLOYEE_FILTERS)).toEqual({
      name: null,
      status: null,
      serviceIds: null,
    });
    expect(
      toEmployeeFilterParams({ name: ' cor ', status: 'INACTIVE', serviceIds: ['e1', 'e2'] }),
    ).toEqual({ name: 'cor', status: 'INACTIVE', serviceIds: 'e1,e2' });
  });

  it('round-trips through the URL', () => {
    const filters = { name: 'cor', status: 'ACTIVE' as const, serviceIds: ['e1'] };
    const params = toEmployeeFilterParams(filters);

    expect(
      toEmployeeFilters({
        name: params['name'],
        status: params['status'],
        serviceIds: params['serviceIds'],
      }),
    ).toEqual(filters);
  });

  it('compares filters by value', () => {
    expect(
      sameEmployeeFilters({ ...NO_EMPLOYEE_FILTERS, serviceIds: [] }, NO_EMPLOYEE_FILTERS),
    ).toBe(true);
    expect(sameEmployeeFilters({ ...NO_EMPLOYEE_FILTERS, name: 'a' }, NO_EMPLOYEE_FILTERS)).toBe(
      false,
    );
    expect(
      sameEmployeeFilters(
        { ...NO_EMPLOYEE_FILTERS, serviceIds: ['a'] },
        { ...NO_EMPLOYEE_FILTERS, serviceIds: ['b'] },
      ),
    ).toBe(false);
  });
});
