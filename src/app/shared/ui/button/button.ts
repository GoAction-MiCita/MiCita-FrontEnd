import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Primary action button. Usage: `<button appButton type="submit" [loading]="pending()">`. */
@Component({
  // Attribute selector keeps native <button> semantics (type, form submit, focus).
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'button[appButton]',
  template: `
    @if (loading()) {
      <span class="button__spinner" aria-hidden="true"></span>
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
