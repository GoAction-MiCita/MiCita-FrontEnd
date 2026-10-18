import { Routes } from '@angular/router';

export default [
  {
    path: 'register',
    title: 'Crea tu cuenta · Mi Cita',
    loadComponent: () => import('./pages/register-page/register-page'),
  },
] satisfies Routes;
