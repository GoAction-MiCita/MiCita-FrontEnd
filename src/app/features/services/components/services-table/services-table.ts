import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SERVICE_STATUS, Service } from '@features/services/models/service.model';
import { formatCop, formatDuration } from '@shared/formatting/format';
import { AvatarGroup } from '@shared/ui/avatar-group/avatar-group';
import { Icon } from '@shared/ui/icon/icon';

/**
 * Services table (HU-08). Becomes a list of cards on small screens.
 * "Editar" emits `edit` (HU-10); toggle and delete stay disabled until HU-11 and HU-14.
 */
@Component({
  selector: 'app-services-table',
  imports: [AvatarGroup, Icon],
  templateUrl: './services-table.html',
  styleUrl: './services-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesTable {
  readonly services = input.required<readonly Service[]>();
  readonly edit = output<Service>();

  protected readonly rows = computed(() =>
    this.services().map((service) => {
      const active = service.status === SERVICE_STATUS.active;
      return {
        service,
        id: service.id,
        name: service.name,
        description: service.description,
        duration: formatDuration(service.durationMinutes),
        price: formatCop(service.price),
        employees: service.employees,
        active,
        statusLabel: active ? 'Activo' : 'Inactivo',
        editLabel: `Editar ${service.name}`,
        toggleLabel: `${active ? 'Desactivar' : 'Activar'} ${service.name}`,
        deleteLabel: `Eliminar ${service.name}`,
      };
    }),
  );
}
