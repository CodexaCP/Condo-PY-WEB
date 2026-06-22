import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreateExpenseChargeRequest, ExpenseCharge } from './models';

@Injectable({ providedIn: 'root' })
export class ExpenseChargesApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<ExpenseCharge[]> {
    return this.http.get<ExpenseCharge[]>(`${API_BASE_URL}/expense-charges`);
  }

  create(request: CreateExpenseChargeRequest): Observable<ExpenseCharge> {
    return this.http.post<ExpenseCharge>(`${API_BASE_URL}/expense-charges`, request);
  }

  update(id: string, request: CreateExpenseChargeRequest): Observable<ExpenseCharge> {
    return this.http.put<ExpenseCharge>(`${API_BASE_URL}/expense-charges/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/expense-charges/${id}`);
  }
}
