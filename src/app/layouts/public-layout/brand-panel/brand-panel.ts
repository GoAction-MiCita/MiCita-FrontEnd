import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from '@shared/ui/icon/icon';

/** Decorative brand side panel of the public (auth) pages. Desktop only. */
@Component({
  selector: 'app-brand-panel',
  imports: [Icon],
  templateUrl: './brand-panel.html',
  styleUrl: './brand-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandPanel {}
