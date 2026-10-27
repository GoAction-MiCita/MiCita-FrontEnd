import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type SpinnerSize = 'sm' | 'md' | 'lg';
/** `brand`: primary ring on a subtle track; `current`: follows the text color (e.g. in buttons). */
export type SpinnerTone = 'brand' | 'current';

/**
 * Decorative loading ring, always aria-hidden: the surrounding `role="status"` text or
 * `aria-busy` control tells assistive technology what is loading.
 */
@Component({
  selector: 'app-spinner',
  template: '',
  styleUrl: './spinner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': '`spinner spinner--${size()} spinner--${tone()}`',
  },
})
export class Spinner {
  readonly size = input<SpinnerSize>('md');
  readonly tone = input<SpinnerTone>('brand');
}
