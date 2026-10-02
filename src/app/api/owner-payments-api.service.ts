import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  OwnerPayment,
  OwnerPaymentRegisterRequest,
  OwnerPaymentRejectRequest,
  OwnerPaymentReviewRequest,
  RegisterPreview
} from './models';

@Injectable({ providedIn: 'root' })
export class OwnerPaymentsApiService {
  private readonly http = inject(HttpClient);

  getAll(status?: string, ownerId?: string): Observable<OwnerPayment[]> {
    const params: Record<string, string> = {};
    if (status) params['status'] = status;
    if (ownerId) params['ownerId'] = ownerId;
    return this.http.get<OwnerPayment[]>(`${API_BASE_URL}/owner-payments`, { params });
  }

  getById(id: string): Observable<OwnerPayment> {
    return this.http.get<OwnerPayment>(`${API_BASE_URL}/owner-payments/${id}`);
  }

  review(id: string, request: OwnerPaymentReviewRequest): Observable<OwnerPayment> {
    return this.http.put<OwnerPayment>(`${API_BASE_URL}/owner-payments/${id}/review`, request);
  }

  approve(id: string): Observable<OwnerPayment> {
    return this.http.put<OwnerPayment>(`${API_BASE_URL}/owner-payments/${id}/approve`, {});
  }

  reject(id: string, request: OwnerPaymentRejectRequest): Observable<OwnerPayment> {
    return this.http.put<OwnerPayment>(`${API_BASE_URL}/owner-payments/${id}/reject`, request);
  }

  getRegisterPreview(ownerId: string): Observable<RegisterPreview> {
    return this.http.get<RegisterPreview>(`${API_BASE_URL}/owner-payments/register-preview/${ownerId}`);
  }

  register(request: OwnerPaymentRegisterRequest): Observable<OwnerPayment> {
    return this.http.post<OwnerPayment>(`${API_BASE_URL}/owner-payments/register`, request);
  }

  reverse(id: string, reason: string): Observable<OwnerPayment> {
    return this.http.put<OwnerPayment>(`${API_BASE_URL}/owner-payments/${id}/reverse`, { reason });
  }

  getOwnerCredit(ownerId: string): Observable<{ amount: number }> {
    return this.http.get<{ amount: number }>(`${API_BASE_URL}/owner-payments/credit/${ownerId}`);
  }

  applyCredit(ownerId: string): Observable<{ settledAmount: number; remainingCredit: number; chargesSettled: number }> {
    return this.http.post<{ settledAmount: number; remainingCredit: number; chargesSettled: number }>(
      `${API_BASE_URL}/owner-payments/apply-credit/${ownerId}`, {}
    );
  }
}
