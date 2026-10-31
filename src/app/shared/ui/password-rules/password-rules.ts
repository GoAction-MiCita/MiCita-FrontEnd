import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  evaluatePassword,
  PASSWORD_RULES,
  PasswordRule,
} from '@shared/forms/validators/password-strength.validator';
import { Icon } from '@shared/ui/icon/icon';

const RULE_LABELS: Readonly<Record<PasswordRule, string>> = {
  minLength: `Mínimo ${PASSWORD_RULES.minLength} caracteres`,
  maxLength: `Máximo ${PASSWORD_RULES.maxLength} caracteres`,
  // The backend only counts ASCII letters here (ñ and accented letters count as special).
  lowercase: 'Una letra minúscula (a-z)',
  uppercase: 'Una letra mayúscula (A-Z)',
  special: 'Un carácter especial (!@#$%)',
};

/** Live checklist of the password rules (see passwordStrength validator). */
@Component({
  selector: 'app-password-rules',
  imports: [Icon],
  templateUrl: './password-rules.html',
  styleUrl: './password-rules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordRules {
  readonly value = input.required<string>();

  protected readonly rules = computed(() =>
    evaluatePassword(this.value())
      // The max length rule only matters once it is broken.
      .filter((result) => result.rule !== 'maxLength' || !result.passed)
      .map((result) => ({ ...result, label: RULE_LABELS[result.rule] })),
  );
}
