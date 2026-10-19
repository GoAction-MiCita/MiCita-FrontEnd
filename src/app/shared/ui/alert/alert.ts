import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon, IconName } from '@shared/ui/icon/icon';

export type AlertVariant = 'danger' | 'success';

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

  protected readonly icon = computed<IconName>(() =>
    this.variant() === 'danger' ? 'alert-circle' : 'check-circle',
  );
}
