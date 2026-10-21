import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { DashboardSummary } from './models';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  // Sin edificio suma todos los accesibles; con buildingId, solo ese edificio.
  getSummary(buildingId?: string): Observable<DashboardSummary> {
    const params = buildingId ? new HttpParams().set('buildingId', buildingId) : undefined;
    return this.http.get<DashboardSummary>(`${API_BASE_URL}/dashboard/summary`, { params });
  }
}
