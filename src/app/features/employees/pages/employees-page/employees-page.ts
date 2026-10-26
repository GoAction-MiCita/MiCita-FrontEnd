import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HOME_PATH } from '@core/auth/auth-guard';
import {
  COMING_SOON,
  EmployeesTable,
} from '@features/employees/components/employees-table/employees-table';
import { EmployeesStore } from '@features/employees/data-access/employees-store';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { Paginator } from '@shared/ui/paginator/paginator';
import { PageSize, Paging, toPaging, toPagingParams } from '@shared/ui/paginator/paging';

/**
 * HU-16: employees of the business (private). The page lives in the query params
 * (`?page=&size=`, page 1-based). Creating, editing and the row actions come in later stories.
 */
@Component({
  selector: 'app-employees-page',
  imports: [Alert, Button, EmployeesTable, Icon, Paginator],
  providers: [EmployeesStore],
  templateUrl: './employees-page.html',
  styleUrl: './employees-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EmployeesPage {
  protected readonly store = inject(EmployeesStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly comingSoon = COMING_SOON;

  // Query params, bound by withComponentInputBinding.
  readonly page = input<string>();
  readonly size = input<string>();

  private readonly urlPaging = computed(() => toPaging({ page: this.page(), size: this.size() }));

  constructor() {
    // Before the first fetch, so a reload on page 3 asks only once.
    const { queryParamMap } = this.route.snapshot;
    this.store.setPaging(
      toPaging({ page: queryParamMap.get('page'), size: queryParamMap.get('size') }),
    );
    effect(() => {
      const paging = this.urlPaging();
      untracked(() => this.store.setPaging(paging));
    });

    // An empty page past the end (a tampered URL): go to the last one.
    effect(() => {
      const last = this.store.lastPageIfOutOfRange();
      if (last !== null) {
        untracked(() => this.goToPage(last));
      }
    });

    // 403 "business required": the dashboard opens the business onboarding (HU-03).
    effect(() => {
      if (this.store.error()?.businessRequired) {
        untracked(() => void this.router.navigateByUrl(HOME_PATH, { replaceUrl: true }));
      }
    });
  }

  protected goToPage(page: number): void {
    this.applyPaging({ page, size: this.store.paging().size });
  }

  /** A new page size starts again from page 1. */
  protected changePageSize(size: PageSize): void {
    this.applyPaging({ page: 0, size });
  }

  // No new history entry per page: the back button leaves the list.
  private applyPaging(paging: Paging): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toPagingParams(paging),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
