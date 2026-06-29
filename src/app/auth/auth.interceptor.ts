import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();
  const isAuthRequest = request.url.endsWith('/auth/login');

  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true'
  };
  if (token && !isAuthRequest) headers['Authorization'] = `Bearer ${token}`;

  const authorizedRequest = request.clone({ setHeaders: headers });

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRequest) {
        auth.logout();
        void router.navigateByUrl('/login');
      }

      return throwError(() => error);
    })
  );
};
