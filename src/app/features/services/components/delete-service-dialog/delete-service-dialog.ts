import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DeleteServiceFailure } from '@features/services/models/delete-service-failure';
import { Service } from '@features/services/models/service.model';
import { Alert } from '@shared/ui/alert/alert';
import { Icon } from '@shared/ui/icon/icon';

/**
 * HU-14 confirmation before deleting a service. Nothing is sent until "Eliminar".
 * Closes with Esc, "Cancelar" or "Cerrar" (emits `closed`); the parent removes it.
 */
@Component({
  selector: 'app-delete-service-dialog',
  imports: [Alert, Icon],
  templateUrl: './delete-service-dialog.html',
  styleUrl: './delete-service-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteServiceDialog {
  readonly service = input.required<Service>();
  readonly pending = input(false);
  readonly failure = input<DeleteServiceFailure | null>(null);

  readonly confirmed = output();
  readonly closed = output();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  /** After a 409 deleting is not possible: only "Cerrar" is offered. */
  protected readonly blocked = computed(() => this.failure()?.blocked ?? false);

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
}
