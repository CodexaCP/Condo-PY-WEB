import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { LibroMovimientosReport } from './models';

export interface LibroMovimientosFilters {
  buildingId: string;
  fromDate: string;
  toDate: string;
}

@Injectable({ providedIn: 'root' })
export class LibroMovimientosApiService {
  private readonly http = inject(HttpClient);

  getReport(filters: LibroMovimientosFilters): Observable<LibroMovimientosReport> {
    const params = new HttpParams()
      .set('buildingId', filters.buildingId)
      .set('fromDate', filters.fromDate)
      .set('toDate', filters.toDate);
    return this.http.get<LibroMovimientosReport>(`${API_BASE_URL}/reportes/libro-movimientos`, { params });
  }

  getPdfUrl(filters: LibroMovimientosFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&buildingId=${encodeURIComponent(filters.buildingId)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/libro-movimientos/pdf?${params}`;
  }

  getExcelUrl(filters: LibroMovimientosFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&buildingId=${encodeURIComponent(filters.buildingId)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/libro-movimientos/excel?${params}`;
  }
}
