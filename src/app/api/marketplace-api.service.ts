import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { MarketplaceAdminBuilding, MarketplaceAdminUpdateRequest, MarketplaceReviewItem } from './models';

// Marketplace de espacios temporales. Con el módulo apagado (o con un plan que no lo incluye) el backend responde
// 403 con { error: 'marketplace_module_disabled' | 'marketplace_plan_not_included', message }.
@Injectable({ providedIn: 'root' })
export class MarketplaceApiService {
  private readonly http = inject(HttpClient);

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

  // SuperAdmin: enciende o apaga el módulo y guarda la comisión y los datos para transferir.
  updateAdminBuilding(buildingId: string, request: MarketplaceAdminUpdateRequest): Observable<MarketplaceAdminBuilding> {
    return this.http.put<MarketplaceAdminBuilding>(`${API_BASE_URL}/marketplace/admin/buildings/${buildingId}`, request);
  }
}
