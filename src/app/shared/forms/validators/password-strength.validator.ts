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
  // ASCII classes, as in the backend pattern: `ñ` or `á` are not lowercase there, but special.
  ['lowercase', (v) => /[a-z]/.test(v)],
  ['uppercase', (v) => /[A-Z]/.test(v)],
  // Special = not an ASCII letter, not an ASCII digit and not whitespace.
  ['special', (v) => /[^A-Za-z0-9\s]/.test(v)],
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
