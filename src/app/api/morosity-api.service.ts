import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { MorosityReport } from './models';

@Injectable({ providedIn: 'root' })
export class MorosityApiService {
  private readonly http = inject(HttpClient);

  getReport(buildingId?: string): Observable<MorosityReport> {
    const params = buildingId ? new HttpParams().set('buildingId', buildingId) : undefined;
    return this.http.get<MorosityReport>(`${API_BASE_URL}/morosity`, { params });
  }
}
