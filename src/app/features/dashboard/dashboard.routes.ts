import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Panel · Mi Cita',
    loadComponent: () => import('./pages/dashboard-page/dashboard-page'),
  },
] satisfies Routes;
