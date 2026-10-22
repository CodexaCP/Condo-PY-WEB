import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  ReconciliationItemRef,
  ReconciliationOverview,
  ReconciliationSummary,
  ReconciliationWorkspace,
  StartReconciliationRequest,
  UpdateReconciliationRequest
} from './building-config.models';

// Conciliación bancaria manual (api/finance/reconciliation). La ven los cuatro roles administrativos; la arman, cierran y reabren solo
// SuperAdmin y Administrador de empresa (y el Encargado, si el edificio lo habilitó). Una conciliación de un edificio ajeno responde 404. Con un mes cerrado, desmarcar o descartar
// movimientos de ese mes responde 409 { error: 'finance_period_closed' }.
@Injectable({ providedIn: 'root' })
export class ReconciliationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/finance/reconciliation`;

  getOverview(buildingId: string): Observable<ReconciliationOverview> {
    return this.http.get<ReconciliationOverview>(this.base, { params: new HttpParams().set('buildingId', buildingId) });
  }

  // Enciende o apaga que el Encargado del edificio pueda conciliar desde la app (solo SuperAdmin y Administrador de empresa).
  setManagerReconcile(buildingId: string, enabled: boolean): Observable<ReconciliationOverview> {
    return this.http.put<ReconciliationOverview>(`${this.base}/settings`, { buildingId, enabled });
  }

  getHistory(buildingId: string, accountId?: string): Observable<ReconciliationSummary[]> {
    let params = new HttpParams().set('buildingId', buildingId);
    if (accountId) params = params.set('accountId', accountId);
    return this.http.get<ReconciliationSummary[]>(`${this.base}/history`, { params });
  }

  // Por defecto solo lo conciliado en esta conciliación; con includePrevious también lo de otras conciliaciones de la cuenta.
  get(id: string, includePrevious = false): Observable<ReconciliationWorkspace> {
    return this.http.get<ReconciliationWorkspace>(`${this.base}/${id}`, { params: new HttpParams().set('includePrevious', includePrevious) });
  }

  // Excel de la conciliación: resumen, conciliados, todos los pendientes y, si se pide, lo de otras conciliaciones.
  exportExcel(id: string, includePrevious = false): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/export`, { params: new HttpParams().set('includePrevious', includePrevious), responseType: 'blob' });
  }

  start(request: StartReconciliationRequest): Observable<ReconciliationWorkspace> {
    return this.http.post<ReconciliationWorkspace>(this.base, request);
  }

  update(id: string, request: UpdateReconciliationRequest): Observable<ReconciliationWorkspace> {
    return this.http.put<ReconciliationWorkspace>(`${this.base}/${id}`, request);
  }

  discard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  mark(id: string, items: ReconciliationItemRef[]): Observable<ReconciliationWorkspace> {
    return this.http.post<ReconciliationWorkspace>(`${this.base}/${id}/mark`, { items });
  }

  unmark(id: string, items: ReconciliationItemRef[]): Observable<ReconciliationWorkspace> {
    return this.http.post<ReconciliationWorkspace>(`${this.base}/${id}/unmark`, { items });
  }

  complete(id: string): Observable<ReconciliationWorkspace> {
    return this.http.post<ReconciliationWorkspace>(`${this.base}/${id}/complete`, {});
  }

  reopen(id: string, reason: string): Observable<ReconciliationWorkspace> {
    return this.http.post<ReconciliationWorkspace>(`${this.base}/${id}/reopen`, { reason });
  }
}
