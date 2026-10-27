import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Spinner } from '../spinner/spinner';

/** Primary action button. Usage: `<button appButton type="submit" [loading]="pending()">`. */
@Component({
  // Attribute selector keeps native <button> semantics (type, form submit, focus).
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appButton]',
  imports: [Spinner],
  template: `
    @if (loading()) {
      <app-spinner size="sm" tone="current" />
    }
    <ng-content />
  `,
  styleUrl: './button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'button',
    '[class.button--block]': 'block()',
    '[attr.aria-busy]': 'loading() || null',
    '[disabled]': 'disabled() || loading()',
  },
})
export class Button {
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly block = input(false, { transform: booleanAttribute });
}
