import { Routes } from '@angular/router';
import { PublicLayout } from '@layouts/public-layout/public-layout';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayout,
    children: [
      { path: 'auth', loadChildren: () => import('@features/auth/auth.routes') },
      { path: '', pathMatch: 'full', redirectTo: 'auth/register' },
    ],
  },
  { path: '**', redirectTo: '' },
];
