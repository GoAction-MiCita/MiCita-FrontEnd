import { decodeJwtPayload } from './jwt';
import { fakeJwt } from './testing/fake-jwt';

describe('decodeJwtPayload', () => {
  it('returns the claims, including non-ASCII values', () => {
    expect(decodeJwtPayload(fakeJwt({ sub: 'analópez', hasBusiness: true }))).toEqual({
      sub: 'analópez',
      hasBusiness: true,
    });
  });

  it.each(['', 'not-a-jwt', 'a.%%%.c', `a.${btoa('[1,2]')}.c`])('returns null for %s', (token) => {
    expect(decodeJwtPayload(token)).toBeNull();
  });
});
