import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HOME_PATH } from '@core/auth/auth-guard';
import { Notifier } from '@core/notifications/notifier';
import {
  EmployeeFormMode,
  EmployeeFormPanel,
} from '@features/employees/components/employee-form-panel/employee-form-panel';
import { EmployeesFilterBar } from '@features/employees/components/employees-filter-bar/employees-filter-bar';
import { EmployeesTable } from '@features/employees/components/employees-table/employees-table';
import { CreateEmployeeStore } from '@features/employees/data-access/create-employee-store';
import { DeleteEmployeeStore } from '@features/employees/data-access/delete-employee-store';
import { EditEmployeeStore } from '@features/employees/data-access/edit-employee-store';
import { EmployeeStatusStore } from '@features/employees/data-access/employee-status-store';
import { EmployeesStore } from '@features/employees/data-access/employees-store';
import { ServiceOptionsStore } from '@features/employees/data-access/service-options-store';
import { employeeStatusChangedMessage } from '@features/employees/models/employee-status-messages';
import {
  EmployeeFilters,
  NO_EMPLOYEE_FILTERS,
  toEmployeeFilterParams,
  toEmployeeFilters,
} from '@features/employees/models/employee-filters';
import { EMPLOYEE_STATUS, Employee, NewEmployee } from '@features/employees/models/employee.model';
import { EMPLOYEES_ERROR_MESSAGES } from '@features/employees/models/employees-error';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { Paginator } from '@shared/ui/paginator/paginator';
import { PageSize, Paging, toPaging, toPagingParams } from '@shared/ui/paginator/paging';
import { Spinner } from '@shared/ui/spinner/spinner';

export const EMPLOYEES_PAGE_MESSAGES = {
  created: 'Empleado creado',
  updated: 'Empleado actualizado',
  deleted: 'Empleado eliminado',
  gone: 'Este empleado ya no existe',
} as const;

/**
 * HU-16 listado, HU-17 registrar, HU-18 editar, HU-20 activar/desactivar, HU-21 eliminar and
 * HU-22 filtrar (private). Filters and page live in the query params
 * (`?name=&status=&serviceIds=&page=&size=`, page 1-based). The page lives in the query params
 * (`?page=&size=`, page 1-based).
 */
@Component({
  selector: 'app-employees-page',
  imports: [
    Alert,
    Button,
    ConfirmDialog,
    EmployeeFormPanel,
    EmployeesFilterBar,
    EmployeesTable,
    Icon,
    Paginator,
    Spinner,
  ],
  providers: [
    EmployeesStore,
    CreateEmployeeStore,
    EditEmployeeStore,
    EmployeeStatusStore,
    DeleteEmployeeStore,
    ServiceOptionsStore,
  ],
  templateUrl: './employees-page.html',
  styleUrl: './employees-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class EmployeesPage {
  protected readonly store = inject(EmployeesStore);
  private readonly createStore = inject(CreateEmployeeStore);
  private readonly editStore = inject(EditEmployeeStore);
  protected readonly statusStore = inject(EmployeeStatusStore);
  protected readonly deleteStore = inject(DeleteEmployeeStore);
  protected readonly servicesStore = inject(ServiceOptionsStore);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** HU-21: the dialog is busy while deleting or while deactivating from its 409 offer. */
  protected readonly deletePending = computed(() => {
    const employee = this.deleteStore.employee();
    return (
      this.deleteStore.pending() ||
      (employee !== null && this.statusStore.pendingIds().has(employee.id))
    );
  });
  protected readonly deletePendingLabel = computed(() =>
    this.deleteStore.failure()?.blocked ? 'Desactivando…' : 'Eliminando…',
  );
  /** After a 409 the dialog offers to deactivate, unless the employee is already inactive. */
  protected readonly deactivateOffer = computed(() =>
    this.deleteStore.employee()?.status === EMPLOYEE_STATUS.active ? 'Desactivar' : null,
  );

  /** `null` while the panel is closed. */
  protected readonly panelMode = signal<EmployeeFormMode | null>(null);

  private readonly editing = computed(() => this.panelMode() === 'edit');
  protected readonly formEmployee = computed(() =>
    this.editing() ? this.editStore.employee() : null,
  );
  protected readonly formLoading = computed(() => this.editing() && this.editStore.loading());
  protected readonly formPending = computed(() =>
    this.editing() ? this.editStore.pending() : this.createStore.pending(),
  );
  protected readonly formFailure = computed(() =>
    this.editing() ? this.editStore.failure() : this.createStore.failure(),
  );

  // Query params, bound by withComponentInputBinding.
  readonly name = input<string>();
  readonly status = input<string>();
  readonly serviceIds = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  private readonly urlFilters = computed(() =>
    toEmployeeFilters({ name: this.name(), status: this.status(), serviceIds: this.serviceIds() }),
  );
  private readonly urlPaging = computed(() => toPaging({ page: this.page(), size: this.size() }));

  /** HU-22: the filter bar is shown unless the business has no employees at all. */
  protected readonly showFilters = computed(() => !this.store.empty());

  constructor() {
    // Before the first fetch, so a reload with filters or on page 3 asks only once.
    const { queryParamMap } = this.route.snapshot;
    this.store.setQuery(
      toEmployeeFilters({
        name: queryParamMap.get('name'),
        status: queryParamMap.get('status'),
        serviceIds: queryParamMap.get('serviceIds'),
      }),
      toPaging({ page: queryParamMap.get('page'), size: queryParamMap.get('size') }),
    );
    effect(() => {
      const filters = this.urlFilters();
      const paging = this.urlPaging();
      untracked(() => this.store.setQuery(filters, paging));
    });

    // HU-22: the services filter needs its options (names of the chosen ones, the picker), once
    // the list confirms the business has employees.
    effect(() => {
      if (this.showFilters() && !this.store.loading()) {
        untracked(() => this.servicesStore.load());
      }
    });

    // HU-22: a 400 means a service of the filter is not valid (e.g. a URL edited by hand): say so
    // and drop the services filter, which fetches the list again.
    effect(() => {
      if (this.store.error()?.invalidFilter) {
        untracked(() => {
          this.notifier.error(EMPLOYEES_ERROR_MESSAGES.invalidServiceFilter);
          this.applyFilters({ ...this.store.filters(), serviceIds: [] });
        });
      }
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

  /** Writes the filters to the URL and goes back to page 1; the list follows the URL. */
  protected applyFilters(filters: EmployeeFilters): void {
    this.navigate({ ...toEmployeeFilterParams(filters), page: null });
  }

  protected clearFilters(): void {
    this.applyFilters(NO_EMPLOYEE_FILTERS);
  }

  /** HU-17: the services for the picker load the first time they are needed. */
  protected openPanel(): void {
    this.createStore.reset();
    this.servicesStore.load();
    this.panelMode.set('create');
  }

  /** HU-18: the form waits for the current data of the employee (GET), not the list row. */
  protected async openEdit(employee: Employee): Promise<void> {
    this.editStore.reset();
    this.servicesStore.load();
    this.panelMode.set('edit');
    if ((await this.editStore.load(employee.id)) === 'not-found') {
      this.employeeGone();
    }
  }

  protected closePanel(): void {
    this.panelMode.set(null);
    // Drops a GET still in flight so it cannot report on a closed panel.
    this.editStore.reset();
  }

  protected submit(employee: NewEmployee): Promise<void> {
    return this.editing() ? this.update(employee) : this.create(employee);
  }

  /** 201: close, reload the current page and confirm; errors stay in the panel. */
  private async create(employee: NewEmployee): Promise<void> {
    if (await this.createStore.create(employee)) {
      this.panelMode.set(null);
      this.store.reload();
      this.notifier.success(EMPLOYEES_PAGE_MESSAGES.created);
    }
  }

  /** 200: close, reload the current page and confirm; 400 and 409 stay in the panel. */
  private async update(changes: NewEmployee): Promise<void> {
    const result = await this.editStore.save(changes);
    if (result === 'saved') {
      this.closePanel();
      this.store.reload();
      this.notifier.success(EMPLOYEES_PAGE_MESSAGES.updated);
    } else if (result === 'not-found') {
      this.employeeGone();
    }
  }

  /** 404 on GET or PUT: deleted meanwhile (or from another business). */
  private employeeGone(): void {
    this.closePanel();
    this.store.reload();
    this.notifier.error(EMPLOYEES_PAGE_MESSAGES.gone);
  }

  /**
   * HU-20: no confirmation; the badge changes only with the 200, errors keep the old status.
   * A 404 also reloads the list, so the employee that no longer exists disappears.
   */
  protected async toggleStatus(employee: Employee): Promise<void> {
    const change = await this.statusStore.toggle(employee);
    if (change.kind === 'changed') {
      this.store.setStatus(employee.id, change.status);
      this.notifier.success(employeeStatusChangedMessage(change.status));
    } else if (change.kind === 'failed') {
      if (change.gone) {
        this.store.reload();
      }
      this.notifier.error(change.message);
    }
  }

  /**
   * HU-21: after a 204 the list is reloaded (an emptied last page moves back one, see the
   * constructor). A 404 also reloads: the employee was already gone.
   */
  protected async confirmDelete(): Promise<void> {
    const result = await this.deleteStore.confirm();
    if (result === 'deleted') {
      this.store.reload();
      this.notifier.success(EMPLOYEES_PAGE_MESSAGES.deleted);
    } else if (result === 'not-found') {
      this.store.reload();
      this.notifier.error(EMPLOYEES_PAGE_MESSAGES.gone);
    }
  }

  /** HU-21 409 offer: deactivates with the HU-20 action and closes the dialog when it answers. */
  protected async deactivateInstead(): Promise<void> {
    const employee = this.deleteStore.employee();
    if (!employee) {
      return;
    }
    await this.toggleStatus(employee);
    this.closeDeleteDialog();
  }

  /**
   * HU-21: not while the row is changing its status (HU-20): the dialog keeps the employee it was
   * opened with, so the 409 message and the deactivate offer would be outdated.
   */
  protected openDelete(employee: Employee): void {
    if (!this.statusStore.pendingIds().has(employee.id)) {
      this.deleteStore.open(employee);
    }
  }

  protected closeDeleteDialog(): void {
    if (!this.deletePending()) {
      this.deleteStore.close();
    }
  }

  protected goToPage(page: number): void {
    this.applyPaging({ page, size: this.store.paging().size });
  }

  /** A new page size starts again from page 1. */
  protected changePageSize(size: PageSize): void {
    this.applyPaging({ page: 0, size });
  }

  private applyPaging(paging: Paging): void {
    this.navigate(toPagingParams(paging));
  }

  // No new history entry per filter or page: the back button leaves the list.
  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
