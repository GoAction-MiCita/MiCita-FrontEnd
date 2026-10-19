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
      { path: 'onboarding', loadChildren: () => import('@features/onboarding/onboarding.routes') },
    ],
  },
  { path: '**', redirectTo: '' },
];
