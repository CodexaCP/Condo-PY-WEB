import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { MorosityReport } from './models';

export interface MorosityReportFilters {
  buildingId?: string;
  agingBucket?: string;
}

@Injectable({ providedIn: 'root' })
export class MorosityApiService {
  private readonly http = inject(HttpClient);

  getReport(filters?: MorosityReportFilters): Observable<MorosityReport> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.agingBucket) params = params.set('agingBucket', filters.agingBucket);
    return this.http.get<MorosityReport>(`${API_BASE_URL}/morosity`, { params });
  }
}
