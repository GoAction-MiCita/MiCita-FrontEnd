import { Injectable, signal } from '@angular/core';

export type NoticeVariant = 'danger' | 'success' | 'info';

export interface Notice {
  readonly id: number;
  readonly message: string;
  readonly variant: NoticeVariant;
}

const AUTO_DISMISS_MS = 6000;

/** App-wide transient message (e.g. 403). Rendered once by the root component. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly current = signal<Notice | null>(null);
  private nextId = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly notice = this.current.asReadonly();

  error(message: string): void {
    this.show(message, 'danger');
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.current.set(null);
  }

  private show(message: string, variant: NoticeVariant): void {
    clearTimeout(this.timer);
    this.current.set({ id: this.nextId++, message, variant });
    this.timer = setTimeout(() => this.current.set(null), AUTO_DISMISS_MS);
  }
}
