import { MultiSelectTexts } from '@shared/ui/multi-select/multi-select';

/** HU-17: texts of the services multi-select in the employee form. */
export const SERVICE_PICKER_TEXTS: MultiSelectTexts = {
  placeholder: 'Seleccionar servicios',
  selected: (count) =>
    count === 1 ? '1 servicio seleccionado' : `${count} servicios seleccionados`,
  none: 'Sin servicios registrados',
  chipsLabel: 'Servicios seleccionados',
  unknown: 'Servicio no disponible',
  search: 'Buscar servicio',
  loading: 'Cargando servicios…',
  failed: 'No pudimos cargar los servicios. Inténtalo de nuevo más tarde.',
  empty: 'Tu negocio aún no tiene servicios. Puedes guardar el empleado sin servicios.',
  noMatches: 'No hay servicios con ese nombre.',
};

/** HU-22: the same picker as a filter of the list (nothing is saved). */
export const SERVICE_FILTER_TEXTS: MultiSelectTexts = {
  ...SERVICE_PICKER_TEXTS,
  placeholder: 'Filtrar por servicios',
  empty: 'Tu negocio aún no tiene servicios.',
};
