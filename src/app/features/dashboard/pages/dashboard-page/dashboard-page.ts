import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';

/** Placeholder until the dashboard story. Private (authGuard). */
@Component({
  selector: 'app-dashboard-page',
  template: `
    <h1>Hola, {{ greetingName() }}</h1>
    <p>Tu panel de administración estará disponible próximamente.</p>
  `,
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DashboardPage {
  private readonly session = inject(AuthSession);

  protected readonly greetingName = computed(() => this.session.user()?.username ?? 'bienvenido');
}
