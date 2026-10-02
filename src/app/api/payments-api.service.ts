import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Payment } from './models';

// Los pagos ya no se cargan desde aqui: se registran con OwnerPaymentsApiService.register (mismo camino que
// un pago aprobado desde la app). Este servicio queda para consultar el historico de pagos cargados a mano.
@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  private readonly http = inject(HttpClient);

  getAll(filters?: { buildingId?: string; expensePeriodId?: string; unitId?: string; legacyOnly?: boolean }): Observable<Payment[]> {
    let params = new HttpParams();
    if (filters?.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters?.expensePeriodId) params = params.set('expensePeriodId', filters.expensePeriodId);
    if (filters?.unitId) params = params.set('unitId', filters.unitId);
    if (filters?.legacyOnly) params = params.set('legacyOnly', true);
    return this.http.get<Payment[]>(`${API_BASE_URL}/payments`, { params });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/payments/${id}`);
  }

  getReceiptPdfUrl(id: string, token: string): string {
    return `${API_BASE_URL}/payments/${id}/receipt-pdf?access_token=${token}`;
  }
}
