import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Empleados · Mi Cita',
    loadComponent: () => import('./pages/employees-page/employees-page'),
  },
] satisfies Routes;
