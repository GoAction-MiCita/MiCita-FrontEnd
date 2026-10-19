import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder for users without a business (hasBusiness = false). Private (authGuard). */
@Component({
  selector: 'app-onboarding-page',
  template: `
    <h1>Registra tu negocio</h1>
    <p>Pronto podrás crear tu negocio para empezar a gestionar tus turnos.</p>
  `,
  styleUrl: './onboarding-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class OnboardingPage {}
