import {
  afterNextRender,
  booleanAttribute,
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
import { Alert } from '@shared/ui/alert/alert';
import { Icon, IconName } from '@shared/ui/icon/icon';

/** Message shown inside the dialog after a failed confirmation. */
export interface ConfirmDialogAlert {
  readonly title: string;
  readonly summary: string;
}

let nextId = 0;

/**
 * Modal confirmation for a destructive action (HU-14 services, HU-21 employees). The question is
 * projected as content; nothing happens until the confirm button. Closes with Esc, "Cancelar" or
 * "Cerrar" (emits `closed`) unless `pending`; the parent removes it.
 * `blocked` (e.g. a 409) hides the confirm button and only offers "Cerrar", plus the optional
 * `blockedActionLabel` alternative (emits `blockedAction`).
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Alert, Icon],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly icon = input<IconName>('trash');
  readonly confirmLabel = input('Eliminar');
  readonly pendingLabel = input('Eliminando…');
  readonly pending = input(false);
  readonly alert = input<ConfirmDialogAlert | null>(null);
  readonly blocked = input(false, { transform: booleanAttribute });
  readonly blockedActionLabel = input<string | null>(null);

  readonly confirmed = output();
  readonly blockedAction = output();
  readonly closed = output();

  protected readonly titleId = `app-confirm-dialog-${nextId}-title`;
  protected readonly descriptionId = `app-confirm-dialog-${nextId++}-description`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Give focus back to the button that opened the dialog (if its row still exists).
    const opener = inject(DOCUMENT).activeElement;
    inject(DestroyRef).onDestroy(() => {
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    });

    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  }

  /** Esc must not drop a request in flight. */
  protected onCancel(event: Event): void {
    if (this.pending()) {
      event.preventDefault();
    }
  }

  protected close(): void {
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

  protected confirm(): void {
    if (!this.pending() && !this.blocked()) {
      this.confirmed.emit();
    }
  }

  protected runBlockedAction(): void {
    if (!this.pending() && this.blocked()) {
      this.blockedAction.emit();
    }
  }
}
