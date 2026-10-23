import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Notifier } from '@core/notifications/notifier';
import {
  ServiceFormMode,
  ServiceFormPanel,
} from '@features/services/components/service-form-panel/service-form-panel';
import { ServicesTable } from '@features/services/components/services-table/services-table';
import { CreateServiceStore } from '@features/services/data-access/create-service-store';
import { EditServiceStore } from '@features/services/data-access/edit-service-store';
import { ServicesStore } from '@features/services/data-access/services-store';
import { NewService, Service } from '@features/services/models/service.model';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';

export const SERVICES_PAGE_MESSAGES = {
  created: 'Servicio creado',
  updated: 'Servicio actualizado',
  gone: 'Este servicio ya no existe',
} as const;

/** HU-08 listado, HU-09 registrar and HU-10 editar servicio (private). */
@Component({
  selector: 'app-services-page',
  imports: [Alert, Button, Icon, ServiceFormPanel, ServicesTable],
  providers: [ServicesStore, CreateServiceStore, EditServiceStore],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ServicesPage {
  protected readonly store = inject(ServicesStore);
  private readonly createStore = inject(CreateServiceStore);
  private readonly editStore = inject(EditServiceStore);
  private readonly notifier = inject(Notifier);

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

  /** 404 on GET or PUT: deleted meanwhile (or from another business). */
  private serviceGone(): void {
    this.closePanel();
    this.store.reload();
    this.notifier.error(SERVICES_PAGE_MESSAGES.gone);
  }
}
