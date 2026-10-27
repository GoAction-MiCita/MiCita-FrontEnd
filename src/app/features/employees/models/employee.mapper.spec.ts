import {
  REJECTED_SERVICES_MESSAGE,
  toCreateEmployeeRequestDto,
  toEmployee,
  toEmployeeListParams,
  toEmployeePage,
  toNewEmployeeFieldErrors,
  toRejectedServiceIds,
  toServiceOptions,
  toUpdateEmployeeRequestDto,
} from './employee.mapper';

describe('employee.mapper · HU-17', () => {
  it('builds the creation body: trimmed names, clean phone, lowercase email, unique services', () => {
    expect(
      toCreateEmployeeRequestDto({
        firstName: ' Ana ',
        lastName: ' López ',
        phone: '+57 (300) 123-4567',
        email: ' Ana@Correo.COM ',
        status: 'ACTIVE',
        serviceIds: ['s1', 's2', 's1'],
      }),
    ).toEqual({
      firstName: 'Ana',
      lastName: 'López',
      phone: '+573001234567',
      email: 'ana@correo.com',
      status: 'ACTIVE',
      serviceIds: ['s1', 's2'],
    });
  });

  it('sends empty optionals as null', () => {
    const dto = toCreateEmployeeRequestDto({
      firstName: 'Ana',
      lastName: 'López',
      phone: ' ',
      email: null,
      status: 'INACTIVE',
      serviceIds: [],
    });
    expect(dto).toMatchObject({ phone: null, email: null, serviceIds: [] });
  });

  it('collapses per-service errors into one message on the services field', () => {
    expect(toNewEmployeeFieldErrors({ firstName: 'x', 'serviceIds[1]': 'y', other: 'z' })).toEqual({
      firstName: 'x',
      serviceIds: REJECTED_SERVICES_MESSAGE,
      other: 'z',
    });
  });

  it('finds the rejected services from serviceIds[i] errors', () => {
    expect(
      toRejectedServiceIds({ 'serviceIds[1]': 'x', 'serviceIds[0]': 'y', 'serviceIds[7]': 'z' }, [
        's1',
        's2',
      ]),
    ).toEqual(['s2', 's1']);
  });

  it('maps the services of the business for the picker', () => {
    expect(
      toServiceOptions({
        content: [
          { id: 's1', name: 'Corte', status: 'ACTIVE' },
          { id: 's2', name: 'Tinte', status: 'INACTIVE' },
        ],
        page: 0,
        size: 100,
        totalElements: 2,
        totalPages: 1,
      }),
    ).toEqual([
      { id: 's1', name: 'Corte', active: true },
      { id: 's2', name: 'Tinte', active: false },
    ]);
  });
});

describe('employee.mapper · HU-18', () => {
  it('builds the update body like the creation one; an empty list removes every service', () => {
    expect(
      toUpdateEmployeeRequestDto({
        firstName: ' Ana ',
        lastName: 'López',
        phone: '300-123-4567',
        email: '',
        status: 'INACTIVE',
        serviceIds: [],
      }),
    ).toEqual({
      firstName: 'Ana',
      lastName: 'López',
      phone: '3001234567',
      email: null,
      status: 'INACTIVE',
      serviceIds: [],
    });
  });

  // Contract of GET /api/empleados/{id}: the edit form preloads this status and saves it back.
  it.each([
    ['ACTIVE', 'ACTIVE'],
    ['active', 'ACTIVE'],
    [' Active ', 'ACTIVE'],
    ['INACTIVE', 'INACTIVE'],
    ['inactive', 'INACTIVE'],
    ['DELETED', 'INACTIVE'],
  ] as const)('reads the detail status %o as %s', (status, expected) => {
    expect(toEmployee({ id: 'e1', firstName: 'Ana', lastName: 'López', status }).status).toBe(
      expected,
    );
  });
});

describe('employee.mapper', () => {
  it('maps a full employee', () => {
    expect(
      toEmployee({
        id: 'e1',
        firstName: 'Ana',
        lastName: 'López',
        phone: '3001234567',
        email: 'ana@correo.com',
        status: 'ACTIVE',
        services: [{ id: 's1', name: 'Corte' }],
      }),
    ).toEqual({
      id: 'e1',
      firstName: 'Ana',
      lastName: 'López',
      fullName: 'Ana López',
      phone: '3001234567',
      email: 'ana@correo.com',
      status: 'ACTIVE',
      services: [{ id: 's1', name: 'Corte' }],
    });
  });

  it('turns missing or blank optional fields into null and no services into []', () => {
    expect(
      toEmployee({ id: 'e2', firstName: ' Juan ', lastName: 'Pérez', phone: '  ', status: 'X' }),
    ).toEqual({
      id: 'e2',
      firstName: 'Juan',
      lastName: 'Pérez',
      fullName: 'Juan Pérez',
      phone: null,
      email: null,
      status: 'INACTIVE',
      services: [],
    });
  });

  it('drops unknown service fields', () => {
    const employee = toEmployee({
      id: 'e3',
      firstName: 'Eva',
      lastName: 'Ruiz',
      status: 'INACTIVE',
      services: [{ id: 's1', name: 'Uñas', extra: true } as never],
    });
    expect(employee.services).toEqual([{ id: 's1', name: 'Uñas' }]);
  });

  it('maps a page', () => {
    expect(
      toEmployeePage({
        content: [{ id: 'e1', firstName: 'Ana', lastName: 'López', status: 'ACTIVE' }],
        page: 1,
        size: 20,
        totalElements: 21,
        totalPages: 2,
      }),
    ).toEqual({
      items: [expect.objectContaining({ id: 'e1', fullName: 'Ana López' })],
      page: 1,
      size: 20,
      totalElements: 21,
      totalPages: 2,
    });
  });

  it('always sends page and size', () => {
    expect(toEmployeeListParams()).toEqual({ page: '0', size: '20' });
    expect(toEmployeeListParams({ page: 2, size: 50 })).toEqual({ page: '2', size: '50' });
  });
});
