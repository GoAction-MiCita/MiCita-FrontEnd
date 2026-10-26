import { toEmployee, toEmployeeListParams, toEmployeePage } from './employee.mapper';

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
