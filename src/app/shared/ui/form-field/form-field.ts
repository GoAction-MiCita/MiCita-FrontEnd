import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl, Validators } from '@angular/forms';
import { ErrorMessages, resolveErrorMessage } from '@shared/forms/error-messages';
import { Icon } from '@shared/ui/icon/icon';

let nextId = 0;

/**
 * Label + input box + hint/error for one form control.
 *
 * Content slots: `[appFieldPrefix]` (icon), the control itself (mark it with `appFormFieldControl`),
 * `[appFieldSuffix]` (e.g. a toggle button) and `[appFieldDetail]` (extra content below the box).
 * Errors show once the control is touched (blur or `markAllAsTouched()` on submit).
 */
@Component({
  selector: 'app-form-field',
  imports: [Icon],
  templateUrl: './form-field.html',
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormField implements AfterContentInit {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly errorMessages = input<ErrorMessages>({});

  readonly controlId = `app-field-${nextId++}`;
  readonly hintId = `${this.controlId}-hint`;
  readonly errorId = `${this.controlId}-error`;

  private readonly ngControl = contentChild.required(NgControl);
  private readonly destroyRef = inject(DestroyRef);
  // Reactive forms are not signal-based: bump this on every control event to recompute.
  private readonly controlVersion = signal(0);

  // Fresh snapshot per event: the control instance never changes, so it can't be the signal value.
  private readonly controlState = computed(() => {
    this.controlVersion();
    const control = this.ngControl().control;
    return {
      required: control?.hasValidator(Validators.required) ?? false,
      invalid: !!control && control.invalid && control.touched,
      errors: control?.errors ?? null,
    };
  });

  readonly required = computed(() => this.controlState().required);
  readonly invalid = computed(() => this.controlState().invalid);

  readonly errorMessage = computed(() => {
    const { invalid, errors } = this.controlState();
    return invalid ? resolveErrorMessage(errors, this.errorMessages()) : null;
  });

  readonly describedBy = computed(() => {
    if (this.errorMessage()) {
      return this.errorId;
    }
    return this.hint() ? this.hintId : null;
  });

  ngAfterContentInit(): void {
    this.ngControl()
      .control?.events.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.controlVersion.update((version) => version + 1));
  }
}
