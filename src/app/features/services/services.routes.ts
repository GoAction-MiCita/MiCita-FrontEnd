import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Servicios · Mi Cita',
    loadComponent: () => import('./pages/services-page/services-page'),
  },
] satisfies Routes;
