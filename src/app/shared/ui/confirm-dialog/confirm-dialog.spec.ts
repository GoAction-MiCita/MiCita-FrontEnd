import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialog, ConfirmDialogAlert } from './confirm-dialog';

@Component({
  imports: [ConfirmDialog],
  template: `
    <app-confirm-dialog
      title="Eliminar servicio"
      [pending]="pending()"
      [alert]="alert()"
      [blocked]="blocked()"
      [blockedActionLabel]="blockedActionLabel()"
      (confirmed)="confirms = confirms + 1"
      (blockedAction)="blockedActions = blockedActions + 1"
      (closed)="closes = closes + 1"
    >
      <p>
        ¿Seguro que quieres eliminar <strong>«{{ name() }}»</strong>?
      </p>
    </app-confirm-dialog>
  `,
})
class Host {
  readonly name = signal('Barba');
  readonly pending = signal(false);
  readonly alert = signal<ConfirmDialogAlert | null>(null);
  readonly blocked = signal(false);
  readonly blockedActionLabel = signal<string | null>(null);
  confirms = 0;
  blockedActions = 0;
  closes = 0;
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  const update = async (change: (host: Host) => void) => {
    change(host);
    await fixture.whenStable();
  };
  return { fixture, element, host, button, update };
}

describe('ConfirmDialog', () => {
  it('opens as a modal alert dialog named by its title and described by the question', async () => {
    const { element } = await render();
    const dialog = element.querySelector('dialog')!;

    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    const title = element.querySelector(`#${dialog.getAttribute('aria-labelledby')}`);
    expect(title?.textContent).toContain('Eliminar servicio');
    const description = element.querySelector(`#${dialog.getAttribute('aria-describedby')}`);
    expect(description?.textContent).toContain('«Barba»');
  });

  it('emits `confirmed` only when "Eliminar" is clicked', async () => {
    const { host, button } = await render();

    expect(host.confirms).toBe(0);
    button('Eliminar')!.click();

    expect(host.confirms).toBe(1);
    expect(host.closes).toBe(0);
  });

  it('closes with "Cancelar" without confirming', async () => {
    const { fixture, host, button } = await render();

    button('Cancelar')!.click();
    await fixture.whenStable();

    expect(host.closes).toBe(1);
    expect(host.confirms).toBe(0);
  });

  it('blocks both buttons and Esc while pending', async () => {
    const { element, host, button, update } = await render();

    await update((h) => h.pending.set(true));

    expect(button('Eliminando…')?.disabled).toBe(true);
    expect(button('Cancelar')?.disabled).toBe(true);
    button('Eliminando…')!.click();
    expect(host.confirms).toBe(0);
    const cancel = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('when blocked shows the alert and only offers "Cerrar"', async () => {
    const { fixture, element, host, button, update } = await render();

    await update((h) => {
      h.alert.set({ title: 'No puedes eliminar este servicio', summary: 'Tiene citas futuras.' });
      h.blocked.set(true);
    });

    expect(element.textContent).toContain('Tiene citas futuras.');
    expect(button('Eliminar')).toBeUndefined();
    button('Cerrar')!.click();
    await fixture.whenStable();
    expect(host.closes).toBe(1);
  });

  it('when blocked can offer an alternative action (e.g. "Desactivar")', async () => {
    const { host, button, update } = await render();

    await update((h) => {
      h.blocked.set(true);
      h.blockedActionLabel.set('Desactivar');
    });
    button('Desactivar')!.click();

    expect(host.blockedActions).toBe(1);
    expect(host.confirms).toBe(0);

    await update((h) => h.pending.set(true));
    expect(button('Eliminando…')?.disabled).toBe(true);
    expect(button('Cerrar')?.disabled).toBe(true);
  });

  it('keeps "Eliminar" available after a retryable failure', async () => {
    const { element, button, update } = await render();

    await update((h) =>
      h.alert.set({ title: 'No pudimos eliminar el servicio', summary: 'Sin conexión' }),
    );

    expect(element.textContent).toContain('Sin conexión');
    expect(button('Eliminar')?.disabled).toBe(false);
  });

  it('renders projected names as text, never as HTML', async () => {
    const { element, update } = await render();

    await update((h) => h.name.set('<img src=x onerror=alert(1)>'));

    expect(element.querySelector('dialog img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
