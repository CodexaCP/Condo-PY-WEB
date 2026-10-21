import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { SupplierAccountsSummary, SupplierPendingDiscount, SupplierReceivable } from './models';

// Cuentas por pagar y por cobrar por proveedor de un edificio.
@Injectable({ providedIn: 'root' })
export class SupplierAccountsApiService {
  private readonly http = inject(HttpClient);

  getSummary(buildingId: string): Observable<SupplierAccountsSummary> {
    return this.http.get<SupplierAccountsSummary>(`${API_BASE_URL}/supplier-accounts/summary`, { params: new HttpParams().set('buildingId', buildingId) });
  }

  getReceivables(buildingId: string, status: 'pending' | 'recovered' | 'all', supplierName?: string): Observable<SupplierReceivable[]> {
    let params = new HttpParams().set('buildingId', buildingId).set('status', status);
    if (supplierName) params = params.set('supplierName', supplierName);
    return this.http.get<SupplierReceivable[]>(`${API_BASE_URL}/supplier-accounts/receivables`, { params });
  }

  // Aviso al cargar una factura: ¿el proveedor tiene descuentos acordados sin aplicar?
  getPendingDiscount(buildingId: string, supplierName: string): Observable<SupplierPendingDiscount> {
    const params = new HttpParams().set('buildingId', buildingId).set('supplierName', supplierName);
    return this.http.get<SupplierPendingDiscount>(`${API_BASE_URL}/supplier-accounts/pending-discount`, { params });
  }
}
