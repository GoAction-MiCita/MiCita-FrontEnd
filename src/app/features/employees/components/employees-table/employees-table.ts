import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EMPLOYEE_STATUS, Employee } from '@features/employees/models/employee.model';
import { EMPTY_VALUE, formatPhone, initials } from '@shared/formatting/format';
import { Icon } from '@shared/ui/icon/icon';
import { TagList } from '@shared/ui/tag-list/tag-list';

/** Shown on row actions that arrive in later stories (HU-17 onwards). */
export const COMING_SOON = 'Próximamente';

/**
 * Employees table (HU-16). Becomes a list of cards on small screens.
 * Edit, activate/deactivate and delete stay disabled until their stories exist.
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

  protected readonly comingSoon = COMING_SOON;
  protected readonly emptyValue = EMPTY_VALUE;

  protected readonly rows = computed(() =>
    this.employees().map((employee) => {
      const active = employee.status === EMPLOYEE_STATUS.active;
      return {
        id: employee.id,
        name: employee.fullName,
        initials: initials(employee.fullName),
        phone: formatPhone(employee.phone),
        hasPhone: employee.phone !== null,
        email: employee.email,
        services: employee.services,
        active,
        statusLabel: active ? 'Activo' : 'Inactivo',
        editLabel: `Editar ${employee.fullName}`,
        toggleLabel: `${active ? 'Desactivar' : 'Activar'} ${employee.fullName}`,
        deleteLabel: `Eliminar ${employee.fullName}`,
      };
    }),
  );
}
