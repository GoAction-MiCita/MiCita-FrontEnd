import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon, IconName } from '@shared/ui/icon/icon';

export interface AdminNavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: IconName;
}

/**
 * Main navigation of the private area. Mobile: fixed bottom bar with icons only (the label is
 * kept for screen readers). Desktop (lg): vertical list with icon and label inside the sidebar.
 */
@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNav {
  readonly items = input.required<readonly AdminNavItem[]>();
}
