import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthSession } from '@core/auth/auth-session';
import { BusinessOnboardingDialog } from '@features/dashboard/components/business-onboarding-dialog/business-onboarding-dialog';
import { OnboardingStore } from '@features/dashboard/data-access/onboarding-store';
import { NewBusiness } from '@features/dashboard/models/business.model';

/** Dashboard (placeholder content). Opens the business onboarding when the user has none (HU-03). */
@Component({
  selector: 'app-dashboard-page',
  imports: [BusinessOnboardingDialog],
  providers: [OnboardingStore],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class DashboardPage {
  private readonly session = inject(AuthSession);
  protected readonly onboarding = inject(OnboardingStore);

  protected readonly greetingName = computed(() => this.session.user()?.username ?? 'bienvenido');
  protected readonly needsOnboarding = computed(() => this.session.user()?.hasBusiness === false);

  protected async createBusiness(business: NewBusiness): Promise<void> {
    await this.onboarding.createBusiness(business);
  }

  protected async logout(): Promise<void> {
    await this.session.logout();
  }
}
