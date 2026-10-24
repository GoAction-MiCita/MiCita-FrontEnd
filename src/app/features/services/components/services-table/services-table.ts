import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SERVICE_STATUS, Service } from '@features/services/models/service.model';
import { formatCop, formatDuration } from '@shared/formatting/format';
import { AvatarGroup } from '@shared/ui/avatar-group/avatar-group';
import { Icon } from '@shared/ui/icon/icon';

/**
 * Services table (HU-08). Becomes a list of cards on small screens.
 * Row actions only emit: `edit` (HU-10), `toggleStatus` (HU-11, disabled while `busyIds` has the row)
 * and `remove` (HU-14).
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
  /** Services whose status change is in flight. */
  readonly busyIds = input<ReadonlySet<string>>(new Set());
  readonly edit = output<Service>();
  readonly toggleStatus = output<Service>();
  readonly remove = output<Service>();

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
        busy: this.busyIds().has(service.id),
        statusLabel: active ? 'Activo' : 'Inactivo',
        editLabel: `Editar ${service.name}`,
        toggleLabel: `${active ? 'Desactivar' : 'Activar'} ${service.name}`,
        deleteLabel: `Eliminar ${service.name}`,
      };
    }),
  );
}
