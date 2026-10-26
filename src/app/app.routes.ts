import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@core/auth/auth-guard';
import { AdminLayout } from '@layouts/admin-layout/admin-layout';
import { PublicLayout } from '@layouts/public-layout/public-layout';

export const routes: Routes = [
  // authGuard sends visitors to /auth/login.
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'auth',
    component: PublicLayout,
    canActivate: [guestGuard],
    loadChildren: () => import('@features/auth/auth.routes'),
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', loadChildren: () => import('@features/dashboard/dashboard.routes') },
      { path: 'servicios', loadChildren: () => import('@features/services/services.routes') },
      { path: 'empleados', loadChildren: () => import('@features/employees/employees.routes') },
      // The onboarding is a dialog on the dashboard (HU-03); keep old links working.
      { path: 'onboarding', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
