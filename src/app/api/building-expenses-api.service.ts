import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { BuildingExpense, CreateBuildingExpenseRequest } from './models';

@Injectable({ providedIn: 'root' })
export class BuildingExpensesApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string }): Observable<BuildingExpense[]> {
    let params = new HttpParams();

    if (filters?.buildingId) {
      params = params.set('buildingId', filters.buildingId);
    }

    if (filters?.expensePeriodId) {
      params = params.set('expensePeriodId', filters.expensePeriodId);
    }

    return this.http.get<BuildingExpense[]>(`${API_BASE_URL}/building-expenses`, { params });
  }

  create(request: CreateBuildingExpenseRequest): Observable<BuildingExpense> {
    return this.http.post<BuildingExpense>(`${API_BASE_URL}/building-expenses`, request);
  }

  update(id: string, request: CreateBuildingExpenseRequest): Observable<BuildingExpense> {
    return this.http.put<BuildingExpense>(`${API_BASE_URL}/building-expenses/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/building-expenses/${id}`);
  }
}
