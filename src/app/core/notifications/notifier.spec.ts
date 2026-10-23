import { TestBed } from '@angular/core/testing';
import { Notifier } from './notifier';

describe('Notifier', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows an error and hides it automatically', () => {
    const notifier = TestBed.inject(Notifier);

    notifier.error('Sin permisos');
    expect(notifier.notice()).toMatchObject({ message: 'Sin permisos', variant: 'danger' });

    vi.advanceTimersByTime(6000);
    expect(notifier.notice()).toBeNull();
  });

  it('shows a success message', () => {
    const notifier = TestBed.inject(Notifier);

    notifier.success('Servicio creado');

    expect(notifier.notice()).toMatchObject({ message: 'Servicio creado', variant: 'success' });
    notifier.dismiss();
  });

  it('can be dismissed', () => {
    const notifier = TestBed.inject(Notifier);

    notifier.error('Sin permisos');
    notifier.dismiss();

    expect(notifier.notice()).toBeNull();
  });
});
