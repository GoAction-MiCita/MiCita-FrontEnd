import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EMPLOYEE_STATUS, Employee } from '@features/employees/models/employee.model';
import { EMPTY_VALUE, formatPhone, initials } from '@shared/formatting/format';
import { Icon } from '@shared/ui/icon/icon';
import { TagList } from '@shared/ui/tag-list/tag-list';

/**
 * Employees table (HU-16). Becomes a list of cards on small screens.
 * Row actions only emit: `edit` (HU-18), `toggleStatus` (HU-20, aria-disabled while `busyIds`
 * has the row) and `remove` (HU-21).
 */
@Component({
  selector: 'app-employees-table',
  imports: [Icon, TagList],
  templateUrl: './employees-table.html',
  styleUrl: './employees-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeesTable {
  readonly employees = input.required<readonly Employee[]>();

  /** HU-20: employees whose status change is in flight. */
  readonly busyIds = input<ReadonlySet<string>>(new Set());

  readonly edit = output<Employee>();
  readonly toggleStatus = output<Employee>();
  readonly remove = output<Employee>();

  protected readonly emptyValue = EMPTY_VALUE;

  protected readonly rows = computed(() => {
    const busy = this.busyIds();
    return this.employees().map((employee) => {
      const active = employee.status === EMPLOYEE_STATUS.active;
      return {
        id: employee.id,
        employee,
        name: employee.fullName,
        initials: initials(employee.fullName),
        phone: formatPhone(employee.phone),
        hasPhone: employee.phone !== null,
        email: employee.email,
        services: employee.services,
        active,
        busy: busy.has(employee.id),
        statusLabel: active ? 'Activo' : 'Inactivo',
        editLabel: `Editar ${employee.fullName}`,
        toggleLabel: `${active ? 'Desactivar' : 'Activar'} ${employee.fullName}`,
        deleteLabel: `Eliminar ${employee.fullName}`,
      };
    });
  });
}
