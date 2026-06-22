import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CollectionReport } from './models';

@Injectable({ providedIn: 'root' })
export class CollectionsApiService {
  private readonly http = inject(HttpClient);

  getReport(buildingId?: string): Observable<CollectionReport> {
    const params = buildingId ? new HttpParams().set('buildingId', buildingId) : undefined;
    return this.http.get<CollectionReport>(`${API_BASE_URL}/collections`, { params });
  }
}
