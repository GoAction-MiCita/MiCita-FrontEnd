import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mirrors the backend `RegisterUserRequest` password rules (72 = BCrypt limit). */
export const PASSWORD_RULES = {
  minLength: 6,
  maxLength: 72,
} as const;

export type PasswordRule = 'minLength' | 'maxLength' | 'lowercase' | 'uppercase' | 'special';

export interface PasswordRuleResult {
  readonly rule: PasswordRule;
  readonly passed: boolean;
}

export interface PasswordStrengthError {
  readonly passwordStrength: { readonly failed: readonly PasswordRule[] };
}

const CHECKS: readonly (readonly [PasswordRule, (value: string) => boolean])[] = [
  ['minLength', (v) => v.length >= PASSWORD_RULES.minLength],
  ['maxLength', (v) => v.length <= PASSWORD_RULES.maxLength],
  ['lowercase', (v) => /\p{Ll}/u.test(v)],
  ['uppercase', (v) => /\p{Lu}/u.test(v)],
  // Special = not a letter, not a digit and not whitespace.
  ['special', (v) => /[^\p{L}\p{N}\s]/u.test(v)],
];

/** Evaluates every password rule; used by the validator and by the rules checklist UI. */
export function evaluatePassword(value: string): PasswordRuleResult[] {
  return CHECKS.map(([rule, passes]) => ({ rule, passed: passes(value) }));
}

/**
 * Fails with `{ passwordStrength: { failed: [...] } }` listing every broken rule.
 * Empty values are left to `Validators.required`.
 */
export function passwordStrength(): ValidatorFn {
  return (control: AbstractControl<string | null>): ValidationErrors | null => {
    const value = control.value ?? '';
    if (value === '') {
      return null;
    }
    const failed = evaluatePassword(value)
      .filter((result) => !result.passed)
      .map((result) => result.rule);
    if (failed.length === 0) {
      return null;
    }
    const error: PasswordStrengthError = { passwordStrength: { failed } };
    return error;
  };
}
