import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, IconName } from '@shared/ui/icon/icon';

export type AlertVariant = 'danger' | 'success' | 'info';

const ICONS: Readonly<Record<AlertVariant, IconName>> = {
  danger: 'alert-circle',
  success: 'check-circle',
  info: 'alert-circle',
};

/** Inline banner. Danger alerts are announced immediately (role="alert"). */
@Component({
  selector: 'app-alert',
  imports: [Icon],
  templateUrl: './alert.html',
  styleUrl: './alert.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"alert alert--" + variant()',
    '[attr.role]': 'variant() === "danger" ? "alert" : "status"',
  },
})
export class Alert {
  readonly variant = input<AlertVariant>('danger');
  readonly title = input<string | null>(null);

  protected readonly icon = computed(() => ICONS[this.variant()]);
}
