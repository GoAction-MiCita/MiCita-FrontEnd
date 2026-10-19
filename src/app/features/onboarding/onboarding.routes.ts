import { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Registra tu negocio · Mi Cita',
    loadComponent: () => import('./pages/onboarding-page/onboarding-page'),
  },
] satisfies Routes;
