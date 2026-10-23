import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { AdminLayout } from './admin-layout';

describe('AdminLayout', () => {
  it('shows the user and logs out', async () => {
    const logout = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSession,
          useValue: { user: signal({ username: 'analopez', hasBusiness: true }), logout },
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayout);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('analopez');

    element.querySelector<HTMLButtonElement>('.admin-layout__logout')!.click();
    await fixture.whenStable();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('links to Inicio and Servicios in the main navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthSession,
          useValue: { user: signal({ username: 'ana', hasBusiness: true }), logout: vi.fn() },
        },
      ],
    });
    const fixture = TestBed.createComponent(AdminLayout);
    await fixture.whenStable();
    const nav = (fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Principal"]');

    const links = Array.from(nav?.querySelectorAll('a') ?? []).map((a) => ({
      text: a.textContent?.trim(),
      href: a.getAttribute('href'),
    }));
    expect(links).toEqual([
      { text: 'Inicio', href: '/dashboard' },
      { text: 'Servicios', href: '/servicios' },
    ]);
  });
});
