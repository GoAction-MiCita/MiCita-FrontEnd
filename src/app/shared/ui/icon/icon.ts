import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'alert-circle'
  | 'at-sign'
  | 'calendar'
  | 'check-circle'
  | 'eye'
  | 'eye-off'
  | 'layout-grid'
  | 'lock'
  | 'log-out'
  | 'logo'
  | 'mail'
  | 'map-pin'
  | 'phone'
  | 'settings'
  | 'user'
  | 'users';

/**
 * Decorative stroke icon (Lucide-style, 24×24). Inherits `color`; size with `font-size`.
 * Always aria-hidden: give the surrounding control its own accessible name.
 */
@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class Icon {
  readonly name = input.required<IconName>();
}
