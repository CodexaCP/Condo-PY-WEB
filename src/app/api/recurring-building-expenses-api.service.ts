import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  ApplyRecurringExpensesRequest,
  ApplyRecurringExpensesResult,
  RecurringBuildingExpense,
  RecurringBuildingExpenseCreateForAllRequest,
  RecurringBuildingExpenseUpsertRequest
} from './models';

@Injectable({ providedIn: 'root' })
export class RecurringBuildingExpensesApiService {
  private readonly http = inject(HttpClient);

  getAll(buildingId?: string): Observable<RecurringBuildingExpense[]> {
    const params: Record<string, string> = {};
    if (buildingId) {
      params['buildingId'] = buildingId;
    }
    return this.http.get<RecurringBuildingExpense[]>(`${API_BASE_URL}/recurring-building-expenses`, { params });
  }

  create(request: RecurringBuildingExpenseUpsertRequest): Observable<RecurringBuildingExpense> {
    return this.http.post<RecurringBuildingExpense>(`${API_BASE_URL}/recurring-building-expenses`, request);
  }

  createForAll(request: RecurringBuildingExpenseCreateForAllRequest): Observable<RecurringBuildingExpense[]> {
    return this.http.post<RecurringBuildingExpense[]>(`${API_BASE_URL}/recurring-building-expenses/create-for-all`, request);
  }

  update(id: string, request: RecurringBuildingExpenseUpsertRequest): Observable<RecurringBuildingExpense> {
    return this.http.put<RecurringBuildingExpense>(`${API_BASE_URL}/recurring-building-expenses/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/recurring-building-expenses/${id}`);
  }

  apply(request: ApplyRecurringExpensesRequest): Observable<ApplyRecurringExpensesResult> {
    return this.http.post<ApplyRecurringExpensesResult>(`${API_BASE_URL}/recurring-building-expenses/apply`, request);
  }
}
