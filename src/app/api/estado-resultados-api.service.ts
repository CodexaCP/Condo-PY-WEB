import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { EstadoResultadosReport } from './models';

export interface EstadoResultadosFilters {
  buildingId: string;
  fromDate: string;
  toDate: string;
}

@Injectable({ providedIn: 'root' })
export class EstadoResultadosApiService {
  private readonly http = inject(HttpClient);

  getReport(filters: EstadoResultadosFilters): Observable<EstadoResultadosReport> {
    const params = new HttpParams()
      .set('buildingId', filters.buildingId)
      .set('fromDate', filters.fromDate)
      .set('toDate', filters.toDate);
    return this.http.get<EstadoResultadosReport>(`${API_BASE_URL}/reportes/estado-resultados`, { params });
  }

  getPdfUrl(filters: EstadoResultadosFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&buildingId=${encodeURIComponent(filters.buildingId)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/estado-resultados/pdf?${params}`;
  }

  getExcelUrl(filters: EstadoResultadosFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&buildingId=${encodeURIComponent(filters.buildingId)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/estado-resultados/excel?${params}`;
  }
}
