import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { PlatformActivity } from './models';

@Injectable({ providedIn: 'root' })
export class PlatformActivityApiService {
  private readonly http = inject(HttpClient);

  // Solo el SuperAdmin. days: ventana del grafico; limit: cuantos movimientos recientes trae la lista.
  get(days = 7, limit = 8): Observable<PlatformActivity> {
    const params = new HttpParams().set('days', days).set('limit', limit);
    return this.http.get<PlatformActivity>(`${API_BASE_URL}/platform-activity`, { params });
  }
}
