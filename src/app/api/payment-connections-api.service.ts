import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  PaymentCatalog, PaymentConnection, PaymentConnectionAudit, PaymentConnectionList, PaymentConnectionRequest
} from './payment-connections.models';

// Conexiones de pago online de la empresa. Las claves secretas son de solo escritura: el servidor nunca las devuelve.
@Injectable({ providedIn: 'root' })
export class PaymentConnectionsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/payment-connections`;

  getCatalog(): Observable<PaymentCatalog> {
    return this.http.get<PaymentCatalog>(`${this.base}/catalog`);
  }

  // companyId solo lo necesita el SuperAdmin (los demás roles operan en su empresa).
  getAll(companyId?: string): Observable<PaymentConnectionList> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<PaymentConnectionList>(this.base, { params });
  }

  getHistory(id: string): Observable<PaymentConnectionAudit[]> {
    return this.http.get<PaymentConnectionAudit[]>(`${this.base}/${id}/history`);
  }

  create(request: PaymentConnectionRequest): Observable<PaymentConnection> {
    return this.http.post<PaymentConnection>(this.base, request);
  }

  update(id: string, request: PaymentConnectionRequest): Observable<PaymentConnection> {
    return this.http.put<PaymentConnection>(`${this.base}/${id}`, request);
  }

  setBuildings(id: string, buildingIds: string[]): Observable<PaymentConnection> {
    return this.http.put<PaymentConnection>(`${this.base}/${id}/buildings`, { buildingIds });
  }

  activate(id: string): Observable<PaymentConnection> {
    return this.http.post<PaymentConnection>(`${this.base}/${id}/activate`, null);
  }

  disable(id: string): Observable<PaymentConnection> {
    return this.http.post<PaymentConnection>(`${this.base}/${id}/disable`, null);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
