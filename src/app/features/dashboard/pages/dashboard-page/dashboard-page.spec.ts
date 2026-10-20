import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthSession } from '@core/auth/auth-session';
import { SessionUser } from '@core/auth/session.model';
import { BusinessApi } from '@features/dashboard/data-access/business-api';
import { of } from 'rxjs';
import DashboardPage from './dashboard-page';

async function render(user: SessionUser) {
  const userSignal = signal<SessionUser | null>(user);
  const session = {
    user: userSignal,
    logout: vi.fn(() => Promise.resolve()),
    expire: vi.fn(() => Promise.resolve()),
    markBusinessCreated: vi.fn(async () => userSignal.set({ ...user, hasBusiness: true })),
  };
  const createOnboarding = vi.fn(() =>
    of({
      id: 'b1',
      name: 'X',
      address: 'Y',
      phone: '3001234567',
      nit: null,
      email: null,
      status: 'ACTIVE',
      timeZone: 'America/Bogota',
    }),
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthSession, useValue: session },
      { provide: BusinessApi, useValue: { createOnboarding } },
    ],
  });
  const fixture = TestBed.createComponent(DashboardPage);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement, session, createOnboarding };
}

describe('DashboardPage', () => {
  it('does not show the onboarding to a user who has a business', async () => {
    const { element } = await render({ username: 'owner', hasBusiness: true });

    expect(element.querySelector('app-business-onboarding-dialog')).toBeNull();
    expect(element.textContent).toContain('Hola, owner');
  });

  it('opens the onboarding for a user without a business and closes it after a 201', async () => {
    const { fixture, element, session, createOnboarding } = await render({
      username: 'ana',
      hasBusiness: false,
    });
    expect(element.querySelector('dialog[open]')).toBeTruthy();

    const set = (name: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    set('name', 'Barbería El Estilo');
    set('address', 'Cra 25');
    set('phone', '3001234567');
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();

    expect(createOnboarding).toHaveBeenCalledTimes(1);
    expect(session.markBusinessCreated).toHaveBeenCalledTimes(1);
    expect(element.querySelector('app-business-onboarding-dialog')).toBeNull();
  });

  it('logs out from the onboarding', async () => {
    const { fixture, element, session } = await render({ username: 'ana', hasBusiness: false });

    element.querySelector<HTMLButtonElement>('.onboarding-dialog__link')!.click();
    await fixture.whenStable();

    expect(session.logout).toHaveBeenCalledTimes(1);
  });
});
