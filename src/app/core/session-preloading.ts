import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';
import { SESSION_KEY } from '../auth/auth.service';

// Descarga por adelantado los módulos del panel solo si hay una sesión iniciada. Quien llega por primera vez (inicio, demo o login)
// no baja ~150 módulos que no va a usar, y la página carga mucho más rápido.
@Injectable({ providedIn: 'root' })
export class SessionPreloadingStrategy implements PreloadingStrategy {
  preload(_route: Route, load: () => Observable<unknown>): Observable<unknown> {
    return this.hasSession() ? load() : of(null);
  }

  private hasSession(): boolean {
    try {
      return typeof localStorage !== 'undefined' && !!localStorage.getItem(SESSION_KEY);
    } catch {
      return false;
    }
  }
}
