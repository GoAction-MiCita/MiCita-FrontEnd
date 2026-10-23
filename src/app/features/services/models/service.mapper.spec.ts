import {
  toCreateServiceRequestDto,
  toNewServiceFieldErrors,
  toService,
  toServicePage,
} from './service.mapper';

describe('service.mapper', () => {
  it('maps a full service', () => {
    expect(
      toService({
        id: 's1',
        name: 'Corte de cabello',
        description: 'Corte profesional',
        durationMinutes: 30,
        price: 45000,
        status: 'ACTIVE',
        employees: [{ id: 'e1', name: 'Ana López', photoUrl: 'https://cdn.test/ana.jpg' }],
      }),
    ).toEqual({
      id: 's1',
      name: 'Corte de cabello',
      description: 'Corte profesional',
      durationMinutes: 30,
      price: 45000,
      status: 'ACTIVE',
      employees: [{ id: 'e1', name: 'Ana López', photoUrl: 'https://cdn.test/ana.jpg' }],
    });
  });

  it('defaults optional fields to null and employees to an empty list', () => {
    expect(toService({ id: 's2', name: 'Barba', description: '  ', status: 'INACTIVE' })).toEqual({
      id: 's2',
      name: 'Barba',
      description: null,
      durationMinutes: null,
      price: null,
      status: 'INACTIVE',
      employees: [],
    });
  });

  it('treats unexpected statuses as inactive', () => {
    expect(toService({ id: 's3', name: 'X', status: 'DELETED' }).status).toBe('INACTIVE');
  });

  it('maps an employee without photo to null', () => {
    const service = toService({
      id: 's4',
      name: 'X',
      status: 'ACTIVE',
      employees: [{ id: 'e1', name: 'Juan' }],
    });

    expect(service.employees[0].photoUrl).toBeNull();
  });

  it('maps the pagination envelope', () => {
    expect(
      toServicePage({
        content: [{ id: 's1', name: 'X', status: 'ACTIVE' }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    ).toMatchObject({ page: 0, size: 20, totalElements: 1, totalPages: 1, items: [{ id: 's1' }] });
  });
});

describe('toCreateServiceRequestDto', () => {
  it('trims the name and turns an empty description into null', () => {
    expect(
      toCreateServiceRequestDto({
        name: '  Corte  ',
        description: '   ',
        durationMinutes: 45,
        price: 45000,
        status: 'ACTIVE',
      }),
    ).toEqual({
      name: 'Corte',
      description: null,
      durationMinutes: 45,
      price: 45000,
      status: 'ACTIVE',
    });
  });

  it('keeps optional numbers as null and never sends employees', () => {
    const dto = toCreateServiceRequestDto({
      name: 'Barba',
      description: ' Arreglo ',
      durationMinutes: null,
      price: null,
      status: 'INACTIVE',
    });

    expect(dto).toMatchObject({ description: 'Arreglo', durationMinutes: null, price: null });
    expect(dto).not.toHaveProperty('employeeIds');
  });
});

describe('toNewServiceFieldErrors', () => {
  it('keeps known fields and passes unknown ones through', () => {
    expect(toNewServiceFieldErrors({ durationMinutes: 'Debe ser mayor a 0', other: 'x' })).toEqual({
      durationMinutes: 'Debe ser mayor a 0',
      other: 'x',
    });
  });
});
