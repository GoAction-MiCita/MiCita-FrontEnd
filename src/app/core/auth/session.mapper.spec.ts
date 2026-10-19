import { fakeJwt } from './testing/fake-jwt';
import { toIssuedSession, toLoginRequestDto, toSessionUser } from './session.mapper';

describe('session.mapper', () => {
  it('trims the identifier and keeps the password untouched', () => {
    expect(toLoginRequestDto({ identifier: ' ana@correo.com ', password: ' Abc#12 ' })).toEqual({
      username: 'ana@correo.com',
      password: ' Abc#12 ',
    });
  });

  it('reads username and hasBusiness from the access token claims', () => {
    expect(toSessionUser(fakeJwt({ sub: 'analopez', hasBusiness: true }))).toEqual({
      username: 'analopez',
      hasBusiness: true,
    });
  });

  it('prefers hasBusiness from the response body', () => {
    expect(toSessionUser(fakeJwt({ sub: 'ana', hasBusiness: true }), false).hasBusiness).toBe(
      false,
    );
  });

  it('defaults to no business when the claim is missing', () => {
    expect(toSessionUser('opaque-token')).toEqual({ username: null, hasBusiness: false });
  });

  it('maps a token response without a rotated refresh token', () => {
    const accessToken = fakeJwt({ sub: 'ana' });

    expect(toIssuedSession({ accessToken })).toEqual({
      accessToken,
      refreshToken: null,
      user: { username: 'ana', hasBusiness: false },
    });
  });
});
