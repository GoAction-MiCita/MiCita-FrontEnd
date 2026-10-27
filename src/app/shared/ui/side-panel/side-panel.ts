import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Icon } from '@shared/ui/icon/icon';

let nextId = 0;

/**
 * Modal side panel: full screen on mobile, docked to the right from md. Projects the body as
 * default content and the main actions with `[appSidePanelActions]` (next to "Cancelar").
 * Closes with Esc, the X or "Cancelar" (emits `closed`) unless `pending`; the parent removes it.
 */
@Component({
  selector: 'app-side-panel',
  imports: [Icon],
  templateUrl: './side-panel.html',
  styleUrl: './side-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidePanel {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly pending = input(false);

  readonly closed = output();

  protected readonly titleId = `app-side-panel-${nextId}-title`;
  protected readonly subtitleId = `app-side-panel-${nextId++}-subtitle`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Give focus back to the button that opened the panel.
    const opener = inject(DOCUMENT).activeElement;
    inject(DestroyRef).onDestroy(() => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    });

    afterNextRender(() => this.open());
  }

  close(): void {
    if (this.pending()) {
      return;
    }
    const dialog = this.dialog().nativeElement;
    // close() fires the `close` event, which emits `closed`.
    if (typeof dialog.close === 'function') {
      dialog.close();
    } else {
      this.closed.emit();
    }
  }

  private open(): void {
    const dialog = this.dialog().nativeElement;
    // showModal() makes the rest of the page inert and traps focus inside the panel.
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  /** Esc must not drop a request in flight. */
  protected onCancel(event: Event): void {
    if (this.pending()) {
      event.preventDefault();
    }
  }
}
