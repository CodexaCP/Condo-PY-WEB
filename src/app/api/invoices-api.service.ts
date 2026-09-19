import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Invoice, InvoiceStatus } from './models';

@Injectable({ providedIn: 'root' })
export class InvoicesApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; unitId?: string; status?: InvoiceStatus }): Observable<Invoice[]> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<Invoice[]>(`${API_BASE_URL}/invoices`, { params });
  }

  getById(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${API_BASE_URL}/invoices/${id}`);
  }

  createDraft(paymentId: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${API_BASE_URL}/invoices/draft`, { paymentId });
  }

  emit(id: string, invoiceSeriesId: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${API_BASE_URL}/invoices/${id}/emit`, { invoiceSeriesId });
  }

  void(id: string, motivo: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${API_BASE_URL}/invoices/${id}/void`, { motivo });
  }

  getPdfUrl(id: string, token: string): string {
    return `${API_BASE_URL}/invoices/${id}/pdf?access_token=${token}`;
  }
}
