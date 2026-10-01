import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const messages = inject(MessageService);
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

      if (error instanceof HttpErrorResponse && error.status === 403) {
        handlePlanRestriction(error, router, messages);
      }

      return throwError(() => error);
    })
  );
};

// Plan vencido: el backend responde 403 con error = plan_blocked (bloqueo total) o plan_read_only (solo consulta).
// Con bloqueo total lo unico que queda es "Mi plan" para enviar el pago. Al cargar una pantalla salen varias
// requests juntas, por eso el aviso se muestra una sola vez cada pocos segundos.
let lastPlanNoticeAt = 0;

function handlePlanRestriction(error: HttpErrorResponse, router: Router, messages: MessageService): void {
  const code = (error.error as { error?: string } | null)?.error;
  if (code !== 'plan_blocked' && code !== 'plan_read_only') return;

  const now = Date.now();
  if (now - lastPlanNoticeAt > 4000) {
    lastPlanNoticeAt = now;
    messages.add({
      severity: 'warn',
      summary: code === 'plan_blocked' ? 'Acceso bloqueado' : 'Sistema en solo lectura',
      detail: (error.error as { message?: string }).message ?? 'El plan está vencido.',
      life: 8000
    });
  }

  if (code === 'plan_blocked' && !router.url.startsWith('/my-plan')) {
    void router.navigateByUrl('/my-plan');
  }
}
