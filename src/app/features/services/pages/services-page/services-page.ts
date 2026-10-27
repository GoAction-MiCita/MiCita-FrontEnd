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
import { Notifier } from '@core/notifications/notifier';
import {
  ServiceFormMode,
  ServiceFormPanel,
} from '@features/services/components/service-form-panel/service-form-panel';
import { ServicesFilterBar } from '@features/services/components/services-filter-bar/services-filter-bar';
import { ServicesTable } from '@features/services/components/services-table/services-table';
import { CreateServiceStore } from '@features/services/data-access/create-service-store';
import { DeleteServiceStore } from '@features/services/data-access/delete-service-store';
import { EditServiceStore } from '@features/services/data-access/edit-service-store';
import { EmployeesStore } from '@features/services/data-access/employees-store';
import { ServiceStatusStore } from '@features/services/data-access/service-status-store';
import { ServicesStore } from '@features/services/data-access/services-store';
import {
  NO_SERVICE_FILTERS,
  ServiceFilters,
  toServiceFilterParams,
  toServiceFilters,
} from '@features/services/models/service-filters';
import { statusChangedMessage } from '@features/services/models/service-status-messages';
import { NewService, Service } from '@features/services/models/service.model';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { Icon } from '@shared/ui/icon/icon';
import { Paginator } from '@shared/ui/paginator/paginator';
import { PageSize, Paging, toPaging, toPagingParams } from '@shared/ui/paginator/paging';
import { Spinner } from '@shared/ui/spinner/spinner';

export const SERVICES_PAGE_MESSAGES = {
  created: 'Servicio creado',
  updated: 'Servicio actualizado',
  deleted: 'Servicio eliminado',
  gone: 'Este servicio ya no existe',
} as const;

/**
 * HU-08 listado, HU-09 registrar, HU-10 editar, HU-11 activar/desactivar, HU-12 empleados,
 * HU-13 filtrar, HU-14 eliminar and HU-15 paginar (private). Filters and page live in the query
 * params (`?name=&status=&employeeIds=&page=&size=`, page 1-based).
 */
@Component({
  selector: 'app-services-page',
  imports: [
    Alert,
    Button,
    ConfirmDialog,
    Icon,
    Paginator,
    ServiceFormPanel,
    ServicesFilterBar,
    ServicesTable,
    Spinner,
  ],
  providers: [
    ServicesStore,
    CreateServiceStore,
    EditServiceStore,
    DeleteServiceStore,
    ServiceStatusStore,
    EmployeesStore,
  ],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ServicesPage {
  protected readonly store = inject(ServicesStore);
  private readonly createStore = inject(CreateServiceStore);
  private readonly editStore = inject(EditServiceStore);
  protected readonly deleteStore = inject(DeleteServiceStore);
  protected readonly statusStore = inject(ServiceStatusStore);
  protected readonly employeesStore = inject(EmployeesStore);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Query params, bound by withComponentInputBinding.
  readonly name = input<string>();
  readonly status = input<string>();
  readonly employeeIds = input<string>();
  readonly page = input<string>();
  readonly size = input<string>();

  private readonly urlFilters = computed(() =>
    toServiceFilters({ name: this.name(), status: this.status(), employeeIds: this.employeeIds() }),
  );
  private readonly urlPaging = computed(() => toPaging({ page: this.page(), size: this.size() }));

  /** `null` while the panel is closed. */
  protected readonly panelMode = signal<ServiceFormMode | null>(null);

  private readonly editing = computed(() => this.panelMode() === 'edit');
  protected readonly formService = computed(() =>
    this.editing() ? this.editStore.service() : null,
  );
  protected readonly formLoading = computed(() => this.editing() && this.editStore.loading());
  protected readonly formPending = computed(() =>
    this.editing() ? this.editStore.pending() : this.createStore.pending(),
  );
  protected readonly formFailure = computed(() =>
    this.editing() ? this.editStore.failure() : this.createStore.failure(),
  );

  constructor() {
    // Before the first fetch, so a reload with filters in the URL asks only once.
    const { queryParamMap } = this.route.snapshot;
    this.store.setQuery(
      toServiceFilters({
        name: queryParamMap.get('name'),
        status: queryParamMap.get('status'),
        employeeIds: queryParamMap.get('employeeIds'),
      }),
      toPaging({ page: queryParamMap.get('page'), size: queryParamMap.get('size') }),
    );
    effect(() => {
      const filters = this.urlFilters();
      const paging = this.urlPaging();
      untracked(() => this.store.setQuery(filters, paging));
    });

    // An empty page past the end (deleting the last row of the last page): go to the last one.
    effect(() => {
      const last = this.store.lastPageIfOutOfRange();
      if (last !== null) {
        untracked(() => this.goToPage(last));
      }
    });
  }

  /** Writes the filters to the URL and goes back to page 1; the list follows the URL. */
  protected applyFilters(filters: ServiceFilters): void {
    this.navigate({ ...toServiceFilterParams(filters), page: null });
  }

  /** HU-15: keeps the filters (they stay in the URL). */
  protected goToPage(page: number): void {
    this.applyPaging({ page, size: this.store.paging().size });
  }

  /** HU-15: a new page size starts again from page 1. */
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

  protected clearFilters(): void {
    this.applyFilters(NO_SERVICE_FILTERS);
  }

  /** HU-11: no confirmation; the badge changes only with the 200, errors keep the old status. */
  protected async toggleStatus(service: Service): Promise<void> {
    const change = await this.statusStore.toggle(service);
    if (change.kind === 'changed') {
      this.store.setStatus(service.id, change.status);
      this.notifier.success(statusChangedMessage(change.status));
    } else if (change.kind === 'failed') {
      this.notifier.error(change.message);
    }
  }

  protected openPanel(): void {
    this.createStore.reset();
    this.panelMode.set('create');
  }

  protected async openEdit(service: Service): Promise<void> {
    this.editStore.reset();
    this.panelMode.set('edit');
    if ((await this.editStore.load(service.id)) === 'not-found') {
      this.serviceGone();
    }
  }

  protected closePanel(): void {
    this.panelMode.set(null);
    // Drops a GET still in flight so it cannot reopen or report on a closed panel.
    this.editStore.reset();
  }

  protected submit(service: NewService): Promise<void> {
    return this.editing() ? this.update(service) : this.create(service);
  }

  private async create(service: NewService): Promise<void> {
    if (await this.createStore.create(service)) {
      this.panelMode.set(null);
      this.store.reload();
      this.notifier.success(SERVICES_PAGE_MESSAGES.created);
    }
  }

  private async update(changes: NewService): Promise<void> {
    const result = await this.editStore.save(changes);
    if (result === 'saved') {
      this.closePanel();
      this.store.reload();
      this.notifier.success(SERVICES_PAGE_MESSAGES.updated);
    } else if (result === 'not-found') {
      this.serviceGone();
    }
  }

  /** HU-14: after a 204 the list is reloaded (going back a page waits for paging, HU-15). */
  protected async confirmDelete(): Promise<void> {
    const result = await this.deleteStore.confirm();
    if (result === 'deleted') {
      this.store.reload();
      this.notifier.success(SERVICES_PAGE_MESSAGES.deleted);
    } else if (result === 'not-found') {
      this.store.reload();
      this.notifier.error(SERVICES_PAGE_MESSAGES.gone);
    }
  }

  /** 404 on GET or PUT: deleted meanwhile (or from another business). */
  private serviceGone(): void {
    this.closePanel();
    this.store.reload();
    this.notifier.error(SERVICES_PAGE_MESSAGES.gone);
  }
}
