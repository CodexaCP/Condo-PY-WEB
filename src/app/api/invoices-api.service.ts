import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Invoice, InvoiceFunnel, InvoiceLedger, InvoiceLedgerQuery, InvoiceStatus } from './models';

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

  // Consulta con filtros, orden, paginación y trazabilidad completa.
  getLedger(query: InvoiceLedgerQuery): Observable<InvoiceLedger> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return this.http.get<InvoiceLedger>(`${API_BASE_URL}/invoices/ledger`, { params });
  }

  getById(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${API_BASE_URL}/invoices/${id}`);
  }

  createDraft(paymentId: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${API_BASE_URL}/invoices/draft`, { paymentId });
  }

  // Prepara un borrador de factura por unidad a partir de un pago de propietario aprobado.
  createDraftsFromOwnerPayment(ownerPaymentId: string): Observable<Invoice[]> {
    return this.http.post<Invoice[]>(`${API_BASE_URL}/invoices/draft-from-owner-payment`, { ownerPaymentId });
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

  // Embudo de facturación: pagos sin ninguna factura, borradores sin emitir, y emitidas.
  getFunnel(buildingId?: string, page = 1, pageSize = 25): Observable<InvoiceFunnel> {
    let params = new HttpParams().set('page', String(page)).set('pageSize', String(pageSize));
    if (buildingId) params = params.set('buildingId', buildingId);
    return this.http.get<InvoiceFunnel>(`${API_BASE_URL}/invoices/funnel`, { params });
  }
}
