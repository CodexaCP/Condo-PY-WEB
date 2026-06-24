import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreatePaymentRequest, ExpenseCharge, Payment } from './models';

@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string; unitId?: string }): Observable<Payment[]> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.expensePeriodId) params = params.set('expensePeriodId', filters.expensePeriodId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    return this.http.get<Payment[]>(`${API_BASE_URL}/payments`, { params });
  }

  getPendingCharges(expensePeriodId: string, unitId: string): Observable<ExpenseCharge[]> {
    let params = new HttpParams()
      .set('expensePeriodId', expensePeriodId)
      .set('unitId', unitId);
    return this.http.get<ExpenseCharge[]>(`${API_BASE_URL}/expense-charges`, { params });
  }

  create(request: CreatePaymentRequest): Observable<Payment> {
    return this.http.post<Payment>(`${API_BASE_URL}/payments`, request);
  }

  update(id: string, request: CreatePaymentRequest): Observable<Payment> {
    return this.http.put<Payment>(`${API_BASE_URL}/payments/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/payments/${id}`);
  }

  getReceiptPdfUrl(id: string, token: string): string {
    return `${API_BASE_URL}/payments/${id}/receipt-pdf?access_token=${token}`;
  }
}
