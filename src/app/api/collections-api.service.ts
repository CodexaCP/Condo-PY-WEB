import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CollectionReport } from './models';

export interface CollectionReportFilters {
  buildingId?: string;
  year?: number;
  fromMonth?: number;
  toMonth?: number;
}

@Injectable({ providedIn: 'root' })
export class CollectionsApiService {
  private readonly http = inject(HttpClient);

  getReport(filters?: CollectionReportFilters): Observable<CollectionReport> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.year) params = params.set('year', filters.year.toString());
    if (filters?.fromMonth) params = params.set('fromMonth', filters.fromMonth.toString());
    if (filters?.toMonth) params = params.set('toMonth', filters.toMonth.toString());
    return this.http.get<CollectionReport>(`${API_BASE_URL}/collections`, { params });
  }
}
