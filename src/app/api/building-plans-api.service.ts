import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  BuildingPlan,
  BuildingPlanSummary,
  BuildingPlanAssignRequest,
  BuildingPlanBulkAssignRequest,
  BuildingPlanSetRenewalRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class BuildingPlansApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/building-plans`;

  getAll(): Observable<BuildingPlan[]> {
    return this.http.get<BuildingPlan[]>(this.baseUrl);
  }

  getById(id: string): Observable<BuildingPlan> {
    return this.http.get<BuildingPlan>(`${this.baseUrl}/${id}`);
  }

  getMyPlan(): Observable<BuildingPlanSummary[]> {
    return this.http.get<BuildingPlanSummary[]>(`${this.baseUrl}/my-plan`);
  }

  assign(request: BuildingPlanAssignRequest): Observable<BuildingPlan> {
    return this.http.post<BuildingPlan>(this.baseUrl, request);
  }

  bulkAssign(request: BuildingPlanBulkAssignRequest): Observable<BuildingPlan[]> {
    return this.http.post<BuildingPlan[]>(`${this.baseUrl}/bulk`, request);
  }

  setRenewal(id: string, request: BuildingPlanSetRenewalRequest): Observable<BuildingPlan> {
    return this.http.put<BuildingPlan>(`${this.baseUrl}/${id}/renewal`, request);
  }
}
