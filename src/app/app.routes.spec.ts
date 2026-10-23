import { Route } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/auth-guard';
import { routes } from './app.routes';

/** Security: every private page must hang from the route guarded by authGuard. */
describe('app routes', () => {
  const privateShell = routes.find(
    (route): route is Route & { children: Route[] } =>
      !!route.children && !!route.canActivate?.includes(authGuard),
  );

  it('guards the private shell with authGuard', () => {
    expect(privateShell).toBeTruthy();
  });

  it.each(['dashboard', 'servicios'])('protects /%s with authGuard', (path) => {
    expect(privateShell?.children.some((child) => child.path === path)).toBe(true);
  });

  it('keeps the auth pages behind guestGuard', () => {
    expect(routes.find((route) => route.path === 'auth')?.canActivate).toContain(guestGuard);
  });

  it('does not expose private pages outside the guarded shell', () => {
    const topLevel = routes.map((route) => route.path);

    expect(topLevel).not.toContain('servicios');
    expect(topLevel).not.toContain('dashboard');
  });
});
