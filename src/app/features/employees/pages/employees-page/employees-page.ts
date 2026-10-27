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
import { EmployeesTable } from '@features/employees/components/employees-table/employees-table';
import { CreateEmployeeStore } from '@features/employees/data-access/create-employee-store';
import { EditEmployeeStore } from '@features/employees/data-access/edit-employee-store';
import { EmployeeStatusStore } from '@features/employees/data-access/employee-status-store';
import { EmployeesStore } from '@features/employees/data-access/employees-store';
import { ServiceOptionsStore } from '@features/employees/data-access/service-options-store';
import { employeeStatusChangedMessage } from '@features/employees/models/employee-status-messages';
import { Employee, NewEmployee } from '@features/employees/models/employee.model';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';
import { Paginator } from '@shared/ui/paginator/paginator';
import { PageSize, Paging, toPaging, toPagingParams } from '@shared/ui/paginator/paging';
import { Spinner } from '@shared/ui/spinner/spinner';

export const EMPLOYEES_PAGE_MESSAGES = {
  created: 'Empleado creado',
  updated: 'Empleado actualizado',
  gone: 'Este empleado ya no existe',
} as const;

/**
 * HU-16 listado, HU-17 registrar, HU-18 editar and HU-20 activar/desactivar (private). The page lives in the query params
 * (`?page=&size=`, page 1-based). Deleting comes in HU-21.
 */
@Component({
  selector: 'app-employees-page',
  imports: [Alert, Button, EmployeeFormPanel, EmployeesTable, Icon, Paginator, Spinner],
  providers: [
    EmployeesStore,
    CreateEmployeeStore,
    EditEmployeeStore,
    EmployeeStatusStore,
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
  protected readonly servicesStore = inject(ServiceOptionsStore);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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

  /** HU-17: the services for the picker load the first time the panel opens. */
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

  /** HU-20: no confirmation; the badge changes only with the 200, errors keep the old status. */
  protected async toggleStatus(employee: Employee): Promise<void> {
    const change = await this.statusStore.toggle(employee);
    if (change.kind === 'changed') {
      this.store.setStatus(employee.id, change.status);
      this.notifier.success(employeeStatusChangedMessage(change.status));
    } else if (change.kind === 'failed') {
      this.notifier.error(change.message);
    }
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
