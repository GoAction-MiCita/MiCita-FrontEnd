import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SidePanel } from './side-panel';

@Component({
  imports: [SidePanel],
  template: `
    @if (open()) {
      <app-side-panel
        title="Agregar servicio"
        [subtitle]="subtitle()"
        [pending]="pending()"
        (closed)="onClosed()"
      >
        <p>Cuerpo</p>
        <button appSidePanelActions type="button">Guardar</button>
      </app-side-panel>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly open = signal(true);
  readonly pending = signal(false);
  readonly subtitle = signal<string | null>(null);
  closes = 0;

  onClosed(): void {
    this.closes++;
    this.open.set(false);
  }
}

async function render(setup: (host: Host) => void = () => undefined) {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  onTestFinished(() => opener.remove());

  const fixture = TestBed.createComponent(Host);
  setup(fixture.componentInstance);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(text) || b.getAttribute('aria-label') === text,
    )!;

  return { fixture, host: fixture.componentInstance, element, opener, button };
}

describe('SidePanel', () => {
  it('opens as a modal labelled by its title, with the body and the projected actions', async () => {
    const { element } = await render();

    const dialog = element.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    const title = element.querySelector('h2')!;
    expect(title.textContent).toContain('Agregar servicio');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.hasAttribute('aria-describedby')).toBe(false);
    expect(element.querySelector('.side-panel__body')?.textContent).toContain('Cuerpo');
    const actions = Array.from(element.querySelectorAll('.side-panel__actions button'));
    expect(actions.map((b) => b.textContent?.trim())).toEqual(['Cancelar', 'Guardar']);
  });

  it('describes the dialog with the optional subtitle', async () => {
    const { element } = await render((host) => host.subtitle.set('Completa la información'));

    const subtitle = element.querySelector('.side-panel__subtitle')!;
    expect(subtitle.textContent).toContain('Completa la información');
    expect(element.querySelector('dialog')?.getAttribute('aria-describedby')).toBe(subtitle.id);
  });

  it.each(['Cancelar', 'Cerrar'])('emits closed with %s', async (text) => {
    const { fixture, host, button } = await render();

    button(text).click();
    await fixture.whenStable();

    expect(host.closes).toBe(1);
  });

  it('lets Esc close it when idle', async () => {
    const { element } = await render();
    const cancel = new Event('cancel', { cancelable: true });

    element.querySelector('dialog')!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(false);
  });

  it('keeps Esc, Cancelar and the X from closing it while pending', async () => {
    const { host, element, button } = await render((host) => host.pending.set(true));

    const cancel = new Event('cancel', { cancelable: true });
    element.querySelector('dialog')!.dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(button('Cancelar').disabled).toBe(true);
    expect(button('Cerrar').disabled).toBe(true);
    expect(host.closes).toBe(0);
  });

  it('gives focus back to the element that opened it when it is removed', async () => {
    const { fixture, opener, button } = await render();
    button('Guardar').focus();

    button('Cancelar').click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
