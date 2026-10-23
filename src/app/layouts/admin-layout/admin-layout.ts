import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { Icon } from '@shared/ui/icon/icon';
import { AdminNav, AdminNavItem } from './admin-nav/admin-nav';

const NAV_ITEMS: readonly AdminNavItem[] = [
  { path: '/dashboard', label: 'Inicio', icon: 'home' },
  { path: '/servicios', label: 'Servicios', icon: 'layout-grid' },
];

/**
 * Shell for private pages. Desktop: blue sidebar on the left with brand, navigation and session.
 * Mobile: top bar (brand and logout) and a bottom navigation bar with icons only.
 */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, Icon, AdminNav],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  protected readonly session = inject(AuthSession);
  protected readonly loggingOut = signal(false);
  protected readonly navItems = NAV_ITEMS;

  protected async logout(): Promise<void> {
    this.loggingOut.set(true);
    try {
      await this.session.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
