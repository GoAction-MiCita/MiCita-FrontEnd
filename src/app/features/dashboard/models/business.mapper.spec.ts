import {
  toBusiness,
  toCreateBusinessRequestDto,
  toNewBusinessFieldErrors,
} from './business.mapper';

describe('business.mapper', () => {
  it('trims text, normalizes the phone and sends empty optional fields as null', () => {
    expect(
      toCreateBusinessRequestDto({
        name: '  Barbería El Estilo ',
        address: ' Cra 25 # 45-67 ',
        phone: '+57 (300) 123-4567',
        nit: '   ',
        email: '',
      }),
    ).toEqual({
      name: 'Barbería El Estilo',
      address: 'Cra 25 # 45-67',
      phone: '+573001234567',
      nit: null,
      email: null,
    });
  });

  it('keeps optional fields that have a value', () => {
    const dto = toCreateBusinessRequestDto({
      name: 'X',
      address: 'Y',
      phone: '3001234567',
      nit: ' 900.123.456-7 ',
      email: ' contacto@negocio.com ',
    });

    expect(dto.nit).toBe('900.123.456-7');
    expect(dto.email).toBe('contacto@negocio.com');
  });

  it('maps the response, defaulting missing optional fields to null', () => {
    expect(
      toBusiness({
        id: 'b1',
        name: 'X',
        address: 'Y',
        phone: '3001234567',
        status: 'ACTIVE',
        timeZone: 'America/Bogota',
      }),
    ).toEqual({
      id: 'b1',
      name: 'X',
      address: 'Y',
      phone: '3001234567',
      nit: null,
      email: null,
      status: 'ACTIVE',
      timeZone: 'America/Bogota',
    });
  });

  it('keeps known field names and passes unknown ones through', () => {
    expect(toNewBusinessFieldErrors({ nit: 'inválido', other: 'x' })).toEqual({
      nit: 'inválido',
      other: 'x',
    });
  });
});
