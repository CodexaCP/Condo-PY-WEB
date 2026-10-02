import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  MarketplaceAccountRow,
  MarketplaceAdjustmentRequest,
  MarketplaceAdminBuilding,
  MarketplaceAdminUpdateRequest,
  MarketplaceReversal,
  MarketplaceReviewItem,
  MarketplaceStaffBuilding,
  MarketplaceStatement
} from './models';

// Marketplace de espacios temporales. Con el módulo apagado (o con un plan que no lo incluye) el backend responde
// 403 con { error: 'marketplace_module_disabled' | 'marketplace_plan_not_included', message }.
@Injectable({ providedIn: 'root' })
export class MarketplaceApiService {
  private readonly http = inject(HttpClient);

  // Edificios del alcance del usuario con el módulo disponible y lo que su rol puede hacer en cada uno (menú y selectores).
  getStaffBuildings(): Observable<MarketplaceStaffBuilding[]> {
    return this.http.get<MarketplaceStaffBuilding[]>(`${API_BASE_URL}/marketplace/staff-buildings`);
  }

  // SuperAdmin: todos los edificios con su plan, el interruptor y la configuración.
  getAdminBuildings(): Observable<MarketplaceAdminBuilding[]> {
    return this.http.get<MarketplaceAdminBuilding[]>(`${API_BASE_URL}/marketplace/admin/buildings`);
  }

  // Personal del edificio: pagos de reservas esperando revisión.
  getPendingPayments(buildingId: string): Observable<MarketplaceReviewItem[]> {
    return this.http.get<MarketplaceReviewItem[]>(`${API_BASE_URL}/marketplace/payments/pending`, { params: { buildingId } });
  }

  // Confirma el pago: el monto del comprobante debe coincidir exacto con el total esperado.
  approvePayment(paymentId: string, reviewedAmount: number): Observable<MarketplaceReviewItem> {
    return this.http.post<MarketplaceReviewItem>(`${API_BASE_URL}/marketplace/payments/${paymentId}/approve`, { reviewedAmount });
  }

  // Rechaza el pago (con motivo): cierra la reserva y libera el horario.
  rejectPayment(paymentId: string, reason: string): Observable<MarketplaceReviewItem> {
    return this.http.post<MarketplaceReviewItem>(`${API_BASE_URL}/marketplace/payments/${paymentId}/reject`, { reason });
  }

  // ── Cuenta aparte del marketplace (por edificio) ─────────────────────────────────────────────────────────────────────

  // Extracto del período (fechas en hora de Paraguay). Sin fechas, el mes en curso.
  getStatement(buildingId: string, from?: string, to?: string): Observable<MarketplaceStatement> {
    return this.http.get<MarketplaceStatement>(`${API_BASE_URL}/marketplace/account/statement`, { params: this.period(buildingId, from, to) });
  }

  // El mismo extracto en Excel.
  exportStatement(buildingId: string, from?: string, to?: string): Observable<Blob> {
    return this.http.get(`${API_BASE_URL}/marketplace/account/statement/export`, {
      params: this.period(buildingId, from, to),
      responseType: 'blob'
    });
  }

  // SuperAdmin: movimiento manual con signo y concepto.
  addAdjustment(request: MarketplaceAdjustmentRequest): Observable<MarketplaceAccountRow> {
    return this.http.post<MarketplaceAccountRow>(`${API_BASE_URL}/marketplace/account/adjustments`, request);
  }

  // SuperAdmin: revierte una acreditación cuyo saldo sigue intacto.
  reverseCredit(reservationId: string, reason: string): Observable<MarketplaceReversal> {
    return this.http.post<MarketplaceReversal>(`${API_BASE_URL}/marketplace/account/reservations/${reservationId}/reverse-credit`, { reason });
  }

  private period(buildingId: string, from?: string, to?: string): HttpParams {
    let params = new HttpParams().set('buildingId', buildingId);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }

  // SuperAdmin: enciende o apaga el módulo y guarda la comisión y los datos para transferir.
  updateAdminBuilding(buildingId: string, request: MarketplaceAdminUpdateRequest): Observable<MarketplaceAdminBuilding> {
    return this.http.put<MarketplaceAdminBuilding>(`${API_BASE_URL}/marketplace/admin/buildings/${buildingId}`, request);
  }
}
