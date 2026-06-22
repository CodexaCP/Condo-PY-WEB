import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export function homeRoute(auth: AuthService): string {
  return auth.hasRole('SuperAdmin') ? '/superadmin' : '/dashboard';
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return auth.mustChangePassword() ? router.createUrlTree(['/change-password']) : true;
};

export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.createUrlTree([homeRoute(auth)]);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([auth.mustChangePassword() ? '/change-password' : homeRoute(auth)]);
};

export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  return auth.mustChangePassword() ? true : router.createUrlTree([homeRoute(auth)]);
};
