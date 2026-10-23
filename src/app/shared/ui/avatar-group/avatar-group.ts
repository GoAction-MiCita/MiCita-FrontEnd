import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EMPTY_VALUE, initials } from '@shared/formatting/format';

// Angular does not sanitize <img src>: accept only http(s) or same-origin paths, else initials.
const SAFE_PHOTO_URL = /^(https?:\/\/|\/(?!\/))/i;

function safePhotoUrl(url: string | null): string | null {
  return url && SAFE_PHOTO_URL.test(url.trim()) ? url.trim() : null;
}

export interface AvatarPerson {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
}

/** Overlapping avatars (photo or initials) with a "+N" chip for the rest. */
@Component({
  selector: 'app-avatar-group',
  templateUrl: './avatar-group.html',
  styleUrl: './avatar-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarGroup {
  readonly people = input.required<readonly AvatarPerson[]>();
  readonly max = input(3);

  protected readonly emptyValue = EMPTY_VALUE;

  protected readonly visible = computed(() =>
    this.people()
      .slice(0, this.max())
      .map((person) => ({
        ...person,
        photoUrl: safePhotoUrl(person.photoUrl),
        initials: initials(person.name),
      })),
  );

  protected readonly hidden = computed(() => Math.max(this.people().length - this.max(), 0));

  protected readonly label = computed(() =>
    this.people()
      .map((person) => person.name)
      .join(', '),
  );
}
