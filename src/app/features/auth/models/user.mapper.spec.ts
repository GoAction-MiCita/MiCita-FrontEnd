import { toNewUserFieldErrors, toRegisterUserRequestDto, toUser } from './user.mapper';
import { NewUser } from './user.model';

const newUser: NewUser = {
  firstName: '  Ana ',
  lastName: 'López ',
  address: ' Cra 25 # 45-67, Medellín',
  phone: '+57 (300) 123-4567',
  email: ' ana@correo.com ',
  username: ' analopez ',
  password: ' Abc#12 ',
};

describe('user.mapper', () => {
  it('trims text fields, normalizes the phone and keeps the password untouched', () => {
    expect(toRegisterUserRequestDto(newUser)).toEqual({
      firstName: 'Ana',
      lastName: 'López',
      address: 'Cra 25 # 45-67, Medellín',
      phone: '+573001234567',
      email: 'ana@correo.com',
      username: 'analopez',
      password: ' Abc#12 ',
    });
  });

  it('maps the response DTO to the domain model', () => {
    const dto = {
      id: 'b4f1',
      firstName: 'Ana',
      lastName: 'López',
      address: 'Cra 25',
      phone: '3001234567',
      email: 'ana@correo.com',
      username: 'analopez',
    };

    expect(toUser(dto)).toEqual(dto);
  });

  it('keeps known field names and passes unknown ones through', () => {
    expect(toNewUserFieldErrors({ email: 'inválido', other: 'x' })).toEqual({
      email: 'inválido',
      other: 'x',
    });
  });
});
