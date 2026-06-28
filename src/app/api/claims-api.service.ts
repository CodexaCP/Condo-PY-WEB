import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Claim, ClaimStatus, ClaimStatusUpdateRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ClaimsApiService {
  private readonly http = inject(HttpClient);

  getAll(buildingId?: string | null, status?: ClaimStatus | null): Observable<Claim[]> {
    let params = new HttpParams();
    if (buildingId) params = params.set('buildingId', buildingId);
    if (status) params = params.set('status', status);
    return this.http.get<Claim[]>(`${API_BASE_URL}/claims`, { params });
  }

  updateStatus(id: string, request: ClaimStatusUpdateRequest): Observable<Claim> {
    return this.http.patch<Claim>(`${API_BASE_URL}/claims/${id}/status`, request);
  }
}
