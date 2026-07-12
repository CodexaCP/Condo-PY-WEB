import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Plan, PlanCreateRequest, PlanUpdateRequest, PlanCloneResult } from './models';

@Injectable({ providedIn: 'root' })
export class PlansApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/plans`;

  getAll(): Observable<Plan[]> {
    return this.http.get<Plan[]>(this.baseUrl);
  }

  getById(id: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.baseUrl}/${id}`);
  }

  create(request: PlanCreateRequest): Observable<Plan> {
    return this.http.post<Plan>(this.baseUrl, request);
  }

  update(id: string, request: PlanUpdateRequest): Observable<Plan> {
    return this.http.put<Plan>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  clone(id: string): Observable<PlanCloneResult> {
    return this.http.post<PlanCloneResult>(`${this.baseUrl}/${id}/clone`, {});
  }
}
