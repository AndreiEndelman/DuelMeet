import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./auth/login/login.page').then(m => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () => import('./auth/register/register.page').then(m => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password/reset-password.page').then(m => m.ResetPasswordPage),
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./auth/verify-email/verify-email.page').then(m => m.VerifyEmailPage),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '/auth/login' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}

