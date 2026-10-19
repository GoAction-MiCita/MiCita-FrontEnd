import { Routes } from '@angular/router';

export default [
  {
    path: 'register',
    title: 'Crea tu cuenta · Mi Cita',
    loadComponent: () => import('./pages/register-page/register-page'),
  },
  {
    path: 'login',
    title: 'Inicia sesión · Mi Cita',
    loadComponent: () => import('./pages/login-page/login-page'),
  },
] satisfies Routes;
