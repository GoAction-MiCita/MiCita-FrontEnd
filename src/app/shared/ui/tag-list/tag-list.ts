import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EMPTY_VALUE } from '@shared/formatting/format';

export interface Tag {
  readonly id: string;
  readonly name: string;
}

/** Tags with a "+N" chip for the rest (the hidden names go in its tooltip and the list label). */
@Component({
  selector: 'app-tag-list',
  templateUrl: './tag-list.html',
  styleUrl: './tag-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TagList {
  readonly tags = input.required<readonly Tag[]>();
  readonly max = input(2);

  protected readonly emptyValue = EMPTY_VALUE;
  protected readonly visible = computed(() => this.tags().slice(0, this.max()));
  private readonly rest = computed(() => this.tags().slice(this.max()));
  protected readonly hidden = computed(() => this.rest().length);
  protected readonly hiddenNames = computed(() =>
    this.rest()
      .map((tag) => tag.name)
      .join(', '),
  );
  protected readonly label = computed(() =>
    this.tags()
      .map((tag) => tag.name)
      .join(', '),
  );
}
