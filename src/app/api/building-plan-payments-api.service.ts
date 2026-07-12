import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  BuildingPlanPayment,
  BuildingPlanPaymentCreateRequest,
  BuildingPlanPaymentRejectRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class BuildingPlanPaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/building-plan-payments`;

  getAll(): Observable<BuildingPlanPayment[]> {
    return this.http.get<BuildingPlanPayment[]>(this.baseUrl);
  }

  getById(id: string): Observable<BuildingPlanPayment> {
    return this.http.get<BuildingPlanPayment>(`${this.baseUrl}/${id}`);
  }

  submit(request: BuildingPlanPaymentCreateRequest): Observable<BuildingPlanPayment> {
    return this.http.post<BuildingPlanPayment>(this.baseUrl, request);
  }

  approve(id: string): Observable<BuildingPlanPayment> {
    return this.http.put<BuildingPlanPayment>(`${this.baseUrl}/${id}/approve`, {});
  }

  reject(id: string, request: BuildingPlanPaymentRejectRequest): Observable<BuildingPlanPayment> {
    return this.http.put<BuildingPlanPayment>(`${this.baseUrl}/${id}/reject`, request);
  }
}
