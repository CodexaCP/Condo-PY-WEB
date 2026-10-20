import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { FakePaymentResult, OnlinePayment } from './online-payments.models';

// Cobros online del personal. El dinero no pasa por Condo-PY: acá solo se ve el registro de cada cobro y, con el proveedor falso encendido,
// se simula la respuesta del proveedor. El flujo del propietario (pagar) vive en la app móvil.
@Injectable({ providedIn: 'root' })
export class OnlinePaymentsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/online-payments`;

  // companyId solo lo necesita el SuperAdmin (los demás roles operan en su empresa).
  getAll(filters: { companyId?: string; buildingId?: string; status?: string; take?: number } = {}): Observable<OnlinePayment[]> {
    let params = new HttpParams();
    if (filters.companyId) params = params.set('companyId', filters.companyId);
    if (filters.buildingId) params = params.set('buildingId', filters.buildingId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.take) params = params.set('take', filters.take);
    return this.http.get<OnlinePayment[]>(`${this.base}/admin`, { params });
  }

  getById(id: string, companyId?: string): Observable<OnlinePayment> {
    let params = new HttpParams();
    if (companyId) params = params.set('companyId', companyId);
    return this.http.get<OnlinePayment>(`${this.base}/admin/${id}`, { params });
  }

  // Simulador: confirma o rechaza el intento como lo haría el proveedor (aviso firmado por el mismo camino del webhook).
  simulate(attemptNumber: number, outcome: 'confirm' | 'reject', amount?: number): Observable<FakePaymentResult> {
    const body = outcome === 'confirm' && amount !== undefined ? { amount } : {};
    return this.http.post<FakePaymentResult>(`${API_BASE_URL}/payment-fake/${attemptNumber}/${outcome}`, body);
  }
}
