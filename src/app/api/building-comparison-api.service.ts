import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingComparisonReport } from './models';

export interface BuildingComparisonFilters {
  fromDate: string;
  toDate: string;
}

@Injectable({ providedIn: 'root' })
export class BuildingComparisonApiService {
  private readonly http = inject(HttpClient);

  getReport(filters: BuildingComparisonFilters): Observable<BuildingComparisonReport> {
    const params = new HttpParams()
      .set('fromDate', filters.fromDate)
      .set('toDate', filters.toDate);
    return this.http.get<BuildingComparisonReport>(`${API_BASE_URL}/reportes/comparativo-edificios`, { params });
  }

  getPdfUrl(filters: BuildingComparisonFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/comparativo-edificios/pdf?${params}`;
  }

  getExcelUrl(filters: BuildingComparisonFilters, token: string): string {
    const params = `access_token=${encodeURIComponent(token)}&fromDate=${filters.fromDate}&toDate=${filters.toDate}`;
    return `${API_BASE_URL}/reportes/comparativo-edificios/excel?${params}`;
  }
}
