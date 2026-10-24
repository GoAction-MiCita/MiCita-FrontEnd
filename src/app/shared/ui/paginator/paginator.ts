import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { isPageSize, PAGE_SIZES, PageSize, pageWindow } from './paging';

let nextId = 0;

/**
 * Generic paginator for any paginated table (HU-15): "Mostrando 21–40 de 57", page size
 * (20/50/100), previous/next and page numbers. Pages are 0-based in and out; shown 1-based.
 * It only emits: the parent asks for the data and keeps the filters.
 */
@Component({
  selector: 'app-paginator',
  templateUrl: './paginator.html',
  styleUrl: './paginator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Paginator {
  /** Current page, 0-based. */
  readonly page = input.required<number>();
  readonly size = input.required<PageSize>();
  readonly totalElements = input.required<number>();
  readonly totalPages = input.required<number>();
  /** Plural noun of the rows, for the summary ("servicios", "empleados"). */
  readonly itemsLabel = input('registros');

  readonly pageChange = output<number>();
  readonly sizeChange = output<PageSize>();

  protected readonly sizes = PAGE_SIZES;
  protected readonly sizeId = `app-paginator-${nextId++}-size`;

  protected readonly summary = computed(() => {
    const total = this.totalElements();
    const first = Math.min(this.page() * this.size() + 1, total);
    const last = Math.min((this.page() + 1) * this.size(), total);
    return `Mostrando ${first}–${last} de ${total} ${this.itemsLabel()}`;
  });

  protected readonly links = computed(() =>
    pageWindow(this.page(), this.totalPages()).map((link) =>
      link.kind === 'gap'
        ? link
        : {
            ...link,
            label: String(link.page + 1),
            ariaLabel: `Página ${link.page + 1}`,
            current: link.page === this.page(),
          },
    ),
  );

  protected readonly isFirst = computed(() => this.page() <= 0);
  protected readonly isLast = computed(() => this.page() >= this.totalPages() - 1);

  protected go(page: number): void {
    if (page >= 0 && page < this.totalPages() && page !== this.page()) {
      this.pageChange.emit(page);
    }
  }

  protected changeSize(event: Event): void {
    const size = Number((event.target as HTMLSelectElement).value);
    if (isPageSize(size) && size !== this.size()) {
      this.sizeChange.emit(size);
    }
  }
}
