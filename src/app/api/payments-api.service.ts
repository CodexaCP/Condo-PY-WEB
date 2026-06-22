import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { CreatePaymentRequest, Payment } from './models';

@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${API_BASE_URL}/payments`);
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
}
