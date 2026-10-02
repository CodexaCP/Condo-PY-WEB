import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ExpenseCharge } from './models';

@Injectable({ providedIn: 'root' })
export class ExpenseChargesApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string }): Observable<ExpenseCharge[]> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.expensePeriodId) params = params.set('expensePeriodId', filters.expensePeriodId);
    return this.http.get<ExpenseCharge[]>(`${API_BASE_URL}/expense-charges`, { params });
  }

  // Solo cargos manuales anteriores (legacy) de un periodo en borrador.
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/expense-charges/${id}`);
  }
}
