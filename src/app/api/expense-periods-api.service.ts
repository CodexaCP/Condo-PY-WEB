import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  ApplyLateFeesRequest,
  ApplyLateFeesResult,
  CreateExpensePeriodRequest,
  ExpensePeriod,
  ExpensePeriodOperationalAlerts,
  ExpenseSettlementChargePreview,
  ExpenseSettlementSummary,
  GenerateExpenseChargesRequest,
  GenerateExpenseChargesResult
} from './models';

@Injectable({ providedIn: 'root' })
export class ExpensePeriodsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<ExpensePeriod[]> {
    return this.http.get<ExpensePeriod[]>(`${API_BASE_URL}/expense-periods`);
  }

  create(request: CreateExpensePeriodRequest): Observable<ExpensePeriod> {
    return this.http.post<ExpensePeriod>(`${API_BASE_URL}/expense-periods`, request);
  }

  update(id: string, request: CreateExpensePeriodRequest): Observable<ExpensePeriod> {
    return this.http.put<ExpensePeriod>(`${API_BASE_URL}/expense-periods/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/expense-periods/${id}`);
  }

  generateCharges(id: string, request: GenerateExpenseChargesRequest): Observable<GenerateExpenseChargesResult> {
    return this.http.post<GenerateExpenseChargesResult>(`${API_BASE_URL}/expense-periods/${id}/generate-charges`, request);
  }

  getSettlement(id: string): Observable<ExpenseSettlementSummary> {
    return this.http.get<ExpenseSettlementSummary>(`${API_BASE_URL}/expense-periods/${id}/settlement`);
  }

  calculateSettlement(id: string): Observable<ExpenseSettlementSummary> {
    return this.http.post<ExpenseSettlementSummary>(`${API_BASE_URL}/expense-periods/${id}/calculate-settlement`, {});
  }

  getSettlementChargePreview(id: string): Observable<ExpenseSettlementChargePreview> {
    return this.http.get<ExpenseSettlementChargePreview>(`${API_BASE_URL}/expense-periods/${id}/settlement-charge-preview`);
  }

  generateSettlementCharges(id: string): Observable<ExpenseSettlementChargePreview> {
    return this.http.post<ExpenseSettlementChargePreview>(`${API_BASE_URL}/expense-periods/${id}/generate-settlement-charges`, {});
  }

  approveSettlement(id: string): Observable<ExpenseSettlementSummary> {
    return this.http.post<ExpenseSettlementSummary>(`${API_BASE_URL}/expense-periods/${id}/approve-settlement`, {});
  }

  publish(id: string): Observable<ExpenseSettlementSummary> {
    return this.http.post<ExpenseSettlementSummary>(`${API_BASE_URL}/expense-periods/${id}/publish`, {});
  }

  applyLateFees(id: string, request: ApplyLateFeesRequest): Observable<ApplyLateFeesResult> {
    return this.http.post<ApplyLateFeesResult>(`${API_BASE_URL}/expense-periods/${id}/apply-late-fees`, request);
  }

  getOperationalAlerts(daysAhead = 7): Observable<ExpensePeriodOperationalAlerts> {
    return this.http.get<ExpensePeriodOperationalAlerts>(`${API_BASE_URL}/expense-periods/operational-alerts`, {
      params: { daysAhead }
    });
  }
}
