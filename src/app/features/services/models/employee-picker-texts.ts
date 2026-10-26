import { MultiSelectTexts } from '@shared/ui/multi-select/multi-select';

/** HU-12: texts of the employees multi-select in the service form and the HU-13 filter bar. */
export const EMPLOYEE_PICKER_TEXTS: MultiSelectTexts = {
  placeholder: 'Seleccionar empleados',
  selected: (count) =>
    count === 1 ? '1 empleado seleccionado' : `${count} empleados seleccionados`,
  none: 'Sin empleados registrados',
  chipsLabel: 'Empleados seleccionados',
  unknown: 'Empleado no disponible',
  search: 'Buscar empleado',
  loading: 'Cargando empleados…',
  failed: 'No pudimos cargar los empleados. Inténtalo de nuevo más tarde.',
  empty: 'Tu negocio aún no tiene empleados registrados. Puedes guardar el servicio sin empleados.',
  noMatches: 'No hay empleados con ese nombre.',
};
