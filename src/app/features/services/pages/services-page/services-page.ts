import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Notifier } from '@core/notifications/notifier';
import { ServiceFormPanel } from '@features/services/components/service-form-panel/service-form-panel';
import { ServicesTable } from '@features/services/components/services-table/services-table';
import { CreateServiceStore } from '@features/services/data-access/create-service-store';
import { ServicesStore } from '@features/services/data-access/services-store';
import { NewService } from '@features/services/models/service.model';
import { Alert } from '@shared/ui/alert/alert';
import { Button } from '@shared/ui/button/button';
import { Icon } from '@shared/ui/icon/icon';

/** HU-08 · Consultar listado de servicios and HU-09 · Registrar servicio (private). */
@Component({
  selector: 'app-services-page',
  imports: [Alert, Button, Icon, ServiceFormPanel, ServicesTable],
  providers: [ServicesStore, CreateServiceStore],
  templateUrl: './services-page.html',
  styleUrl: './services-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ServicesPage {
  protected readonly store = inject(ServicesStore);
  protected readonly createStore = inject(CreateServiceStore);
  private readonly notifier = inject(Notifier);

  protected readonly panelOpen = signal(false);

  protected openPanel(): void {
    this.createStore.reset();
    this.panelOpen.set(true);
  }

  protected closePanel(): void {
    this.panelOpen.set(false);
  }

  protected async create(service: NewService): Promise<void> {
    if (await this.createStore.create(service)) {
      this.panelOpen.set(false);
      this.store.reload();
      this.notifier.success('Servicio creado');
    }
  }
}
