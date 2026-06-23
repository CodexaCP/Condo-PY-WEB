import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingIncome, CreateBuildingIncomeRequest, RolloverIncomeRequest, RolloverIncomeResult } from './models';

@Injectable({ providedIn: 'root' })
export class BuildingIncomesApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string }): Observable<BuildingIncome[]> {
    let params = new HttpParams();

    if (filters?.buildingId) {
      params = params.set('buildingId', filters.buildingId);
    }

    if (filters?.expensePeriodId) {
      params = params.set('expensePeriodId', filters.expensePeriodId);
    }

    return this.http.get<BuildingIncome[]>(`${API_BASE_URL}/building-incomes`, { params });
  }

  create(request: CreateBuildingIncomeRequest): Observable<BuildingIncome> {
    return this.http.post<BuildingIncome>(`${API_BASE_URL}/building-incomes`, request);
  }

  update(id: string, request: CreateBuildingIncomeRequest): Observable<BuildingIncome> {
    return this.http.put<BuildingIncome>(`${API_BASE_URL}/building-incomes/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/building-incomes/${id}`);
  }

  rollover(request: RolloverIncomeRequest): Observable<RolloverIncomeResult> {
    return this.http.post<RolloverIncomeResult>(`${API_BASE_URL}/building-incomes/rollover`, request);
  }
}
