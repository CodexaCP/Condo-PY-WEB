import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  ApplyLateFeesRequest,
  ApplyLateFeesResult,
  BulkCreateExpensePeriodsRequest,
  BulkCreateExpensePeriodsResult,
  CloneExpensePeriodResult,
  CreateExpensePeriodRequest,
  ExpensePeriod,
  ExpensePeriodOperationalAlerts,
  ExpenseSettlementChargePreview,
  ExpenseSettlementSummary,
  GenerateExpenseChargesRequest,
  GenerateExpenseChargesResult,
  VoidSettlementResult
} from './models';

@Injectable({ providedIn: 'root' })
export class ExpensePeriodsApiService {
  private readonly http = inject(HttpClient);
  private cache$: Observable<ExpensePeriod[]> | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL_MS = 30_000;

  getAll(): Observable<ExpensePeriod[]> {
    if (!this.cache$ || Date.now() > this.cacheExpiry) {
      this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
      this.cache$ = this.http.get<ExpensePeriod[]>(`${API_BASE_URL}/expense-periods`).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  private invalidateCache(): void { this.cache$ = null; }

  create(request: CreateExpensePeriodRequest): Observable<ExpensePeriod> {
    return this.http.post<ExpensePeriod>(`${API_BASE_URL}/expense-periods`, request).pipe(tap(() => this.invalidateCache()));
  }

  update(id: string, request: CreateExpensePeriodRequest): Observable<ExpensePeriod> {
    return this.http.put<ExpensePeriod>(`${API_BASE_URL}/expense-periods/${id}`, request).pipe(tap(() => this.invalidateCache()));
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/expense-periods/${id}`).pipe(tap(() => this.invalidateCache()));
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

  bulkCreate(request: BulkCreateExpensePeriodsRequest): Observable<BulkCreateExpensePeriodsResult> {
    return this.http.post<BulkCreateExpensePeriodsResult>(`${API_BASE_URL}/expense-periods/bulk-create`, request);
  }

  clone(id: string): Observable<CloneExpensePeriodResult> {
    return this.http.post<CloneExpensePeriodResult>(`${API_BASE_URL}/expense-periods/${id}/clone`, {});
  }

  voidSettlement(id: string): Observable<VoidSettlementResult> {
    return this.http.post<VoidSettlementResult>(`${API_BASE_URL}/expense-periods/${id}/void-settlement`, {});
  }

  getSettlementPdfUrl(id: string, token: string): string {
    return `${API_BASE_URL}/expense-periods/${id}/settlement-pdf?access_token=${token}`;
  }
}
