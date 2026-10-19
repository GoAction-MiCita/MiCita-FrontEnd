import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthSession } from '@core/auth/auth-session';
import { Icon } from '@shared/ui/icon/icon';

/** Shell for private pages: top bar with the user and logout. */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, Icon],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  protected readonly session = inject(AuthSession);
  protected readonly loggingOut = signal(false);

  protected async logout(): Promise<void> {
    this.loggingOut.set(true);
    try {
      await this.session.logout();
    } finally {
      this.loggingOut.set(false);
    }
  }
}
