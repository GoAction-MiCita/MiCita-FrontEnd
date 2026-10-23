import { TestBed } from '@angular/core/testing';
import { DeleteServiceFailure } from '@features/services/models/delete-service-failure';
import { Service } from '@features/services/models/service.model';
import { DeleteServiceDialog } from './delete-service-dialog';

const service: Service = {
  id: 's1',
  name: 'Barba',
  description: null,
  durationMinutes: 20,
  price: 20000,
  status: 'ACTIVE',
  employees: [],
};

async function render(name = service.name) {
  const fixture = TestBed.createComponent(DeleteServiceDialog);
  fixture.componentRef.setInput('service', { ...service, name });
  let confirms = 0;
  let closes = 0;
  fixture.componentInstance.confirmed.subscribe(() => confirms++);
  fixture.componentInstance.closed.subscribe(() => closes++);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  return { fixture, element, button, confirms: () => confirms, closes: () => closes };
}

describe('DeleteServiceDialog', () => {
  it('opens as a modal alert dialog with the service name', async () => {
    const { element } = await render();
    const dialog = element.querySelector('dialog')!;

    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(element.querySelector('h2')?.textContent).toContain('Eliminar servicio');
    expect(element.textContent).toContain('«Barba»');
  });

  it('emits `confirmed` only when "Eliminar" is clicked', async () => {
    const { button, confirms, closes } = await render();

    expect(confirms()).toBe(0);
    button('Eliminar')!.click();

    expect(confirms()).toBe(1);
    expect(closes()).toBe(0);
  });

  it('closes with "Cancelar" without confirming', async () => {
    const { fixture, button, confirms, closes } = await render();

    button('Cancelar')!.click();
    await fixture.whenStable();

    expect(closes()).toBe(1);
    expect(confirms()).toBe(0);
  });

  it('blocks both buttons and Esc while deleting', async () => {
    const { fixture, element, button, confirms } = await render();

    fixture.componentRef.setInput('pending', true);
    await fixture.whenStable();

    expect(button('Eliminando…')?.disabled).toBe(true);
    expect(button('Cancelar')?.disabled).toBe(true);
    button('Eliminando…')!.click();
    expect(confirms()).toBe(0);
    const cancel = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
  });

  it('after a 409 shows the message and only offers "Cerrar"', async () => {
    const { fixture, element, button, closes } = await render();

    fixture.componentRef.setInput('failure', {
      title: 'No puedes eliminar este servicio',
      summary: '«Barba» tiene citas futuras. Puedes desactivarlo en su lugar.',
      blocked: true,
    } satisfies DeleteServiceFailure);
    await fixture.whenStable();

    expect(element.textContent).toContain('tiene citas futuras');
    expect(button('Eliminar')).toBeUndefined();
    button('Cerrar')!.click();
    await fixture.whenStable();
    expect(closes()).toBe(1);
  });

  it('keeps "Eliminar" available after a retryable failure', async () => {
    const { fixture, element, button } = await render();

    fixture.componentRef.setInput('failure', {
      title: 'No pudimos eliminar el servicio',
      summary: 'Sin conexión',
      blocked: false,
    } satisfies DeleteServiceFailure);
    await fixture.whenStable();

    expect(element.textContent).toContain('Sin conexión');
    expect(button('Eliminar')?.disabled).toBe(false);
  });

  it('renders the service name as text, never as HTML', async () => {
    const { element } = await render('<img src=x onerror=alert(1)>');

    expect(element.querySelector('dialog img')).toBeNull();
    expect(element.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
