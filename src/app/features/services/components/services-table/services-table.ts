import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { SERVICE_STATUS, Service } from '@features/services/models/service.model';
import { formatCop, formatDuration } from '@shared/formatting/format';
import { AvatarGroup } from '@shared/ui/avatar-group/avatar-group';
import { Icon } from '@shared/ui/icon/icon';

/**
 * Services table (HU-08). Becomes a list of cards on small screens.
 * Row actions are shown disabled until HU-10 (edit), HU-11 (toggle) and HU-14 (delete).
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

  protected readonly rows = computed(() =>
    this.services().map((service) => {
      const active = service.status === SERVICE_STATUS.active;
      return {
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
